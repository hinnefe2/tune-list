<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import Dialog from 'primevue/dialog'
import Button from 'primevue/button'
import FileUpload, { type FileUploadSelectEvent } from 'primevue/fileupload'
import Message from 'primevue/message'
import { useToast } from 'primevue/usetoast'
import { parseTunesCsv, type ParseResult } from '@/lib/csv-import'
import { useTunesStore } from '@/stores/tunes'
import { STATUS_LABEL } from '@/lib/tune-options'

const visible = defineModel<boolean>('visible', { required: true })

const tunesStore = useTunesStore()
const toast = useToast()

const file = ref<File | null>(null)
const parsing = ref(false)
const parseResult = ref<ParseResult | null>(null)
const importing = ref(false)
const errorMsg = ref<string | null>(null)

watch(visible, (v) => {
  if (!v) {
    file.value = null
    parseResult.value = null
    errorMsg.value = null
    parsing.value = false
    importing.value = false
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
  if (!parseResult.value) return
  importing.value = true
  errorMsg.value = null
  try {
    const inserts = parseResult.value.valid.map((r) => r.insert)
    const created = await tunesStore.createMany(inserts)
    toast.add({
      severity: 'success',
      summary: `Imported ${created.length} tune${created.length === 1 ? '' : 's'}`,
      life: 3000,
    })
    visible.value = false
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : String(e)
  } finally {
    importing.value = false
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
        <span class="font-mono text-xs">notes</span>. Use
        <span class="font-mono text-xs">|</span> inside a cell to separate multiple values
        (e.g. <span class="font-mono text-xs">A|G</span> for alt_keys).
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
          :disabled="parseResult.valid.length === 0"
          @click="handleImport"
        >
          Import {{ parseResult.valid.length }} tune{{ parseResult.valid.length === 1 ? '' : 's' }}
        </Button>
      </div>
    </template>
  </Dialog>
</template>
