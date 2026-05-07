<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import Dialog from 'primevue/dialog'
import Button from 'primevue/button'
import FileUpload, { type FileUploadSelectEvent } from 'primevue/fileupload'
import Message from 'primevue/message'
import { useToast } from 'primevue/usetoast'
import { parseTunesCsv, type ParseResult } from '@/lib/csv-import'
import { useTunesStore } from '@/stores/tunes'
import { useSourcesStore } from '@/stores/sources'
import { useAuthStore } from '@/stores/auth'
import { linkSourceToTune } from '@/services/tune-sources'
import { createMediaLink } from '@/services/media'
import { STATUS_LABEL } from '@/lib/tune-options'

const visible = defineModel<boolean>('visible', { required: true })

const tunesStore = useTunesStore()
const sourcesStore = useSourcesStore()
const auth = useAuthStore()
const toast = useToast()

const file = ref<File | null>(null)
const parsing = ref(false)
const parseResult = ref<ParseResult | null>(null)
const importing = ref(false)
const importPhase = ref<'idle' | 'creating' | 'linking'>('idle')
const importDone = ref(0)
const importTotal = ref(0)
const errorMsg = ref<string | null>(null)

watch(visible, (v) => {
  if (!v) {
    file.value = null
    parseResult.value = null
    errorMsg.value = null
    parsing.value = false
    importing.value = false
    importPhase.value = 'idle'
    importDone.value = 0
    importTotal.value = 0
  }
})

async function handleFileSelect(event: FileUploadSelectEvent) {
  const f = (Array.isArray(event.files) ? event.files[0] : event.files) as File | undefined
  if (!f) return
  file.value = f
  parsing.value = true
  errorMsg.value = null
  parseResult.value = null
  try {
    parseResult.value = await parseTunesCsv(f)
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : String(e)
  } finally {
    parsing.value = false
  }
}

const previewRows = computed(() => parseResult.value?.valid.slice(0, 5) ?? [])

const warningCount = computed(
  () => parseResult.value?.valid.filter((r) => r.warnings.length > 0).length ?? 0,
)

async function handleImport() {
  if (!parseResult.value || !auth.user) return
  importing.value = true
  errorMsg.value = null
  importPhase.value = 'creating'
  importDone.value = 0
  importTotal.value = parseResult.value.valid.length
  try {
    const userId = auth.user.id
    const parsed = parseResult.value.valid
    const inserts = parsed.map((r) => r.insert)
    const created = await tunesStore.createMany(inserts)

    // Bulk-insert preserves input order. Walk created/parsed in lockstep to
    // attach sources and media links on a best-effort basis — a single failed
    // link shouldn't abort the rest of the import.
    if (!sourcesStore.initialized) await sourcesStore.init()
    const sourcesByName = new Map<string, string>()
    for (const s of sourcesStore.sources) sourcesByName.set(s.name, s.id)

    let linkedSourceCount = 0
    let mediaCount = 0
    const linkErrors: string[] = []

    importPhase.value = 'linking'
    importDone.value = 0

    for (let i = 0; i < created.length; i++) {
      const tune = created[i]
      const row = parsed[i]
      if (!tune || !row) {
        importDone.value = i + 1
        continue
      }

      // New sources have to be resolved serially so two tunes referencing the
      // same brand-new name don't both try to create it. Once we know the
      // source id, the actual link insert can run alongside the media writes.
      const sourceIds: string[] = []
      for (const name of row.sourceNames) {
        try {
          let sourceId = sourcesByName.get(name)
          if (!sourceId) {
            const newSource = await sourcesStore.create({ name, kind: 'other' })
            sourceId = newSource.id
            sourcesByName.set(name, sourceId)
          }
          sourceIds.push(sourceId)
        } catch (e) {
          linkErrors.push(`${tune.name} → source "${name}": ${e instanceof Error ? e.message : String(e)}`)
        }
      }

      const linkPromises: Promise<{ kind: 'source' | 'media'; ok: boolean; label: string; err?: unknown }>[] = []
      sourceIds.forEach((sourceId, j) => {
        const name = row.sourceNames[j]
        linkPromises.push(
          linkSourceToTune(userId, tune.id, sourceId)
            .then(() => ({ kind: 'source' as const, ok: true, label: name }))
            .catch((err) => ({ kind: 'source' as const, ok: false, label: name, err })),
        )
      })
      for (const media of row.mediaLinks) {
        linkPromises.push(
          createMediaLink({
            user_id: userId,
            tune_id: tune.id,
            kind: media.kind,
            url: media.url,
            storage_path: null,
          })
            .then(() => ({ kind: 'media' as const, ok: true, label: media.kind }))
            .catch((err) => ({ kind: 'media' as const, ok: false, label: media.kind, err })),
        )
      }
      const results = await Promise.all(linkPromises)
      for (const r of results) {
        if (r.ok) {
          if (r.kind === 'source') linkedSourceCount++
          else mediaCount++
        } else {
          const detail = r.err instanceof Error ? r.err.message : String(r.err)
          linkErrors.push(
            r.kind === 'source'
              ? `${tune.name} → source "${r.label}": ${detail}`
              : `${tune.name} → ${r.label}: ${detail}`,
          )
        }
      }

      importDone.value = i + 1
    }

    const detailParts: string[] = []
    if (linkedSourceCount) detailParts.push(`${linkedSourceCount} source link${linkedSourceCount === 1 ? '' : 's'}`)
    if (mediaCount) detailParts.push(`${mediaCount} media link${mediaCount === 1 ? '' : 's'}`)
    toast.add({
      severity: 'success',
      summary: `Imported ${created.length} tune${created.length === 1 ? '' : 's'}`,
      detail: detailParts.length ? `Also added ${detailParts.join(' and ')}.` : undefined,
      life: 4000,
    })
    if (linkErrors.length) {
      toast.add({
        severity: 'warn',
        summary: `${linkErrors.length} link${linkErrors.length === 1 ? '' : 's'} failed`,
        detail: linkErrors.slice(0, 3).join('\n'),
        life: 8000,
      })
    }
    visible.value = false
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : String(e)
  } finally {
    importing.value = false
    importPhase.value = 'idle'
  }
}
</script>

<template>
  <Dialog
    v-model:visible="visible"
    header="Import tunes from CSV"
    modal
    :style="{ width: 'min(680px, 95vw)' }"
    :dismissable-mask="!importing"
    :closable="!importing"
  >
    <div class="space-y-4">
      <p class="text-sm text-surface-600 dark:text-surface-400">
        Upload a CSV with one row per tune. Recognized columns (case-insensitive):
        <span class="font-mono text-xs">name</span>,
        <span class="font-mono text-xs">key</span>,
        <span class="font-mono text-xs">aka</span>,
        <span class="font-mono text-xs">alt_keys</span>,
        <span class="font-mono text-xs">tuning</span>,
        <span class="font-mono text-xs">genre</span>,
        <span class="font-mono text-xs">status</span>,
        <span class="font-mono text-xs">notes</span>,
        <span class="font-mono text-xs">source</span>,
        <span class="font-mono text-xs">audio_url</span>,
        <span class="font-mono text-xs">sheet_url</span>,
        <span class="font-mono text-xs">looptube_url</span>. Use
        <span class="font-mono text-xs">|</span> inside a cell to separate multiple values
        (e.g. <span class="font-mono text-xs">A|G</span> for alt_keys, or two source names).
        Sources are matched by name and created as kind <span class="font-mono text-xs">other</span> if new.
      </p>

      <div v-if="!parseResult" class="flex items-center gap-3">
        <FileUpload
          mode="basic"
          accept=".csv,text/csv"
          :auto="false"
          :show-upload-button="false"
          choose-label="Choose CSV"
          custom-upload
          @select="handleFileSelect"
        />
        <span v-if="parsing" class="text-sm text-surface-500">
          <i class="pi pi-spin pi-spinner mr-2" /> Parsing…
        </span>
      </div>

      <Message v-if="errorMsg" severity="error" :closable="false">{{ errorMsg }}</Message>

      <template v-if="parseResult">
        <div class="text-sm space-y-1">
          <div>
            <strong>{{ parseResult.valid.length }}</strong>
            valid row{{ parseResult.valid.length === 1 ? '' : 's' }}.
            <span v-if="parseResult.skipped.length">
              {{ parseResult.skipped.length }} skipped (missing name).
            </span>
          </div>
          <div v-if="warningCount" class="text-amber-700 dark:text-amber-400">
            {{ warningCount }} row{{ warningCount === 1 ? '' : 's' }} had unrecognized status values
            and defaulted to Wishlist.
          </div>
          <div v-if="parseResult.unrecognizedHeaders.length" class="text-surface-500">
            Ignored columns: {{ parseResult.unrecognizedHeaders.join(', ') }}
          </div>
        </div>

        <div v-if="previewRows.length" class="border border-surface-200 dark:border-surface-800 rounded overflow-hidden">
          <table class="w-full text-sm">
            <thead class="bg-surface-50 dark:bg-surface-900 text-left">
              <tr>
                <th class="px-3 py-2 font-medium">Name</th>
                <th class="px-3 py-2 font-medium">Key</th>
                <th class="px-3 py-2 font-medium">Tuning</th>
                <th class="px-3 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(r, i) in previewRows"
                :key="i"
                class="border-t border-surface-200 dark:border-surface-800"
              >
                <td class="px-3 py-2">{{ r.insert.name }}</td>
                <td class="px-3 py-2">{{ r.insert.key ?? '—' }}</td>
                <td class="px-3 py-2">{{ r.insert.tuning }}</td>
                <td class="px-3 py-2">{{ STATUS_LABEL[r.insert.status ?? 'wishlist'] }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p v-if="parseResult.valid.length > previewRows.length" class="text-xs text-surface-500">
          Showing first {{ previewRows.length }} of {{ parseResult.valid.length }}.
        </p>

        <Message
          v-if="parseResult.errors.length"
          severity="warn"
          :closable="false"
        >
          Parse errors: {{ parseResult.errors.slice(0, 3).join('; ') }}
          <span v-if="parseResult.errors.length > 3">…and {{ parseResult.errors.length - 3 }} more.</span>
        </Message>

        <div
          v-if="importing"
          class="rounded border border-surface-200 dark:border-surface-800 p-3 text-sm space-y-2"
          aria-live="polite"
        >
          <div class="flex items-center gap-2">
            <i class="pi pi-spin pi-spinner" />
            <span v-if="importPhase === 'creating'">
              Creating {{ importTotal }} tune{{ importTotal === 1 ? '' : 's' }}…
            </span>
            <span v-else-if="importPhase === 'linking'">
              Linking sources and media… {{ importDone }} / {{ importTotal }}
            </span>
            <span v-else>Working…</span>
          </div>
          <div
            v-if="importPhase === 'linking' && importTotal > 0"
            class="h-1.5 rounded bg-surface-200 dark:bg-surface-800 overflow-hidden"
          >
            <div
              class="h-full bg-primary-500 transition-[width] duration-200"
              :style="{ width: `${Math.round((importDone / importTotal) * 100)}%` }"
            />
          </div>
          <p class="text-xs text-surface-500">Don't close this dialog until it finishes.</p>
        </div>
      </template>
    </div>

    <template #footer>
      <div class="flex justify-end gap-2">
        <Button severity="secondary" text :disabled="importing" @click="visible = false">
          Cancel
        </Button>
        <Button
          v-if="parseResult"
          :loading="importing"
          :disabled="parseResult.valid.length === 0 || importing"
          @click="handleImport"
        >
          Import {{ parseResult.valid.length }} tune{{ parseResult.valid.length === 1 ? '' : 's' }}
        </Button>
      </div>
    </template>
  </Dialog>
</template>
