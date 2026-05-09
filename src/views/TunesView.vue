<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useToast } from 'primevue/usetoast'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import Select from 'primevue/select'
import IconField from 'primevue/iconfield'
import InputIcon from 'primevue/inputicon'
import InputText from 'primevue/inputtext'
import Menu from 'primevue/menu'
import Skeleton from 'primevue/skeleton'
import Badge from 'primevue/badge'
import { useTunesStore } from '@/stores/tunes'
import { useUiStore } from '@/stores/ui'
import TuneList from '@/components/TuneList.vue'
import TuneEditor, { type NewMediaRow } from '@/components/TuneEditor.vue'
import TuneImportDialog from '@/components/TuneImportDialog.vue'
import { useAuthStore } from '@/stores/auth'
import { listAllMedia } from '@/services/media'
import type { Source } from '@/services/sources'
import type { TuneInsert, TuneUpdate, Tune, TuneStatus } from '@/services/tunes'
import { createTuneWithAttachments } from '@/services/tune-creation'
import { reportSaveResult } from '@/lib/save-reporter'
import {
  STATUS_OPTIONS,
  SORT_FIELDS,
  STATUS_SORT_INDEX,
  type SortField,
} from '@/lib/tune-options'
import { tunesToCsv, downloadCsv, isoToday } from '@/lib/csv-export'
import { listAllRecordings } from '@/services/recordings'
import { downloadRecordingBlob } from '@/services/storage'
import JSZip from 'jszip'
import { useDelayed } from '@/composables/useDelayed'
import { useShortcut } from '@/composables/useShortcuts'

const tunesStore = useTunesStore()
const ui = useUiStore()
const toast = useToast()
const auth = useAuthStore()
const router = useRouter()

const showSkeleton = useDelayed(
  computed(() => tunesStore.loading && !tunesStore.initialized),
)

const editorOpen = ref(false)
const editingTune = ref<Tune | null>(null)
const importOpen = ref(false)
const addSortMenu = ref<InstanceType<typeof Menu> | null>(null)
const filtersOpen = ref(false)
const sortOpen = ref(false)
const exporting = ref(false)
const searchMobile = ref<InstanceType<typeof InputText> | null>(null)
const searchDesktop = ref<InstanceType<typeof InputText> | null>(null)

function focusSearch() {
  for (const c of [searchDesktop.value, searchMobile.value]) {
    const el = (c as { $el?: HTMLInputElement } | null)?.$el
    if (el && el.offsetParent !== null) {
      el.focus()
      el.select()
      return
    }
  }
}

useShortcut('/', (e) => {
  if (editorOpen.value || importOpen.value) return
  e.preventDefault()
  focusSearch()
})

useShortcut('a', () => {
  if (editorOpen.value || importOpen.value) return
  openAdd()
})

// Keyboard row selection: tracked by id (not index) so sort/filter changes
// don't shift the highlight onto a different tune.
const selectedId = ref<string | null>(null)
const selectedIndex = computed(() =>
  selectedId.value ? filtered.value.findIndex((t) => t.id === selectedId.value) : -1,
)

function moveSelection(delta: number) {
  const list = filtered.value
  if (!list.length) return
  const cur = selectedIndex.value
  const next = cur < 0 ? 0 : Math.max(0, Math.min(list.length - 1, cur + delta))
  selectedId.value = list[next].id
}

useShortcut('j', () => {
  if (editorOpen.value || importOpen.value) return
  moveSelection(1)
})
useShortcut('k', () => {
  if (editorOpen.value || importOpen.value) return
  moveSelection(-1)
})
useShortcut('Enter', (e) => {
  if (editorOpen.value || importOpen.value) return
  // Only act when nothing else is focused — otherwise Enter belongs to the
  // focused button/link/menu item.
  if (document.activeElement && document.activeElement !== document.body) return
  if (!selectedId.value) return
  e.preventDefault()
  router.push({ name: 'tune-detail', params: { id: selectedId.value } })
})

async function setStatus(tuneId: string, status: TuneStatus) {
  try {
    await tunesStore.update(tuneId, { status })
  } catch (e) {
    toast.add({
      severity: 'error',
      summary: 'Failed to update status',
      detail: e instanceof Error ? e.message : String(e),
      life: 5000,
    })
  }
}

// Digit-to-status mirrors STATUS_OPTIONS order so the help dialog and the
// status dropdown stay in sync if statuses are ever reordered.
STATUS_OPTIONS.forEach((opt, idx) => {
  useShortcut(String(idx + 1), () => {
    if (editorOpen.value || importOpen.value) return
    if (!selectedId.value) return
    setStatus(selectedId.value, opt.value)
  })
})

onMounted(async () => {
  try {
    await tunesStore.init()
  } catch (e) {
    toast.add({
      severity: 'error',
      summary: 'Failed to load tunes',
      detail: e instanceof Error ? e.message : String(e),
      life: 5000,
    })
  }
})

function sortValue(t: Tune, field: SortField): string | number | null {
  if (field === 'status') return STATUS_SORT_INDEX[t.status]
  if (field === 'created_at' || field === 'updated_at') return t[field]
  const v = t[field]
  if (typeof v === 'string') return v.toLocaleLowerCase()
  return v ?? null
}

const filtered = computed(() => {
  const f = ui.tuneFilters
  const search = f.search.trim().toLowerCase()
  const list = tunesStore.tunes.filter((t) => {
    if (f.status && t.status !== f.status) return false
    if (f.key && t.key !== f.key) return false
    if (f.genre && t.genre !== f.genre) return false
    if (f.tuning && t.tuning !== f.tuning) return false
    if (search) {
      const hay = (t.name + ' ' + (t.aka ?? []).join(' ') + ' ' + (t.notes ?? '')).toLowerCase()
      if (!hay.includes(search)) return false
    }
    return true
  })
  return [...list].sort((a, b) => {
    for (const c of f.sortBy) {
      const av = sortValue(a, c.field)
      const bv = sortValue(b, c.field)
      // null/empty always sort last regardless of direction.
      const aEmpty = av === null || av === ''
      const bEmpty = bv === null || bv === ''
      if (aEmpty && bEmpty) continue
      if (aEmpty) return 1
      if (bEmpty) return -1
      const dir = c.dir === 'asc' ? 1 : -1
      if (av < bv) return -1 * dir
      if (av > bv) return 1 * dir
    }
    return 0
  })
})

const keyChoices = computed(() => {
  const set = new Set<string>()
  for (const t of tunesStore.tunes) if (t.key) set.add(t.key)
  return Array.from(set).sort().map((k) => ({ value: k, label: k }))
})
const genreChoices = computed(() => {
  const set = new Set<string>()
  for (const t of tunesStore.tunes) if (t.genre) set.add(t.genre)
  return Array.from(set).sort().map((g) => ({ value: g, label: g }))
})
const tuningChoices = computed(() => {
  const set = new Set<string>()
  for (const t of tunesStore.tunes) if (t.tuning) set.add(t.tuning)
  return Array.from(set).sort().map((t) => ({ value: t, label: t }))
})

function openAdd() {
  editingTune.value = null
  editorOpen.value = true
}

function safeFilename(s: string, max = 60): string {
  return s
    .replace(/[\/\\:*?"<>|]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max) || 'untitled'
}

async function handleExport() {
  if (exporting.value) return
  exporting.value = true
  try {
    const [media, recordings] = await Promise.all([
      listAllMedia(),
      listAllRecordings(),
    ])
    const csv = tunesToCsv(tunesStore.tunes, media)
    const today = isoToday()

    if (recordings.length === 0) {
      downloadCsv(`tunes-${today}.csv`, csv)
      toast.add({
        severity: 'success',
        summary: `Exported ${tunesStore.tunes.length} tunes`,
        detail: media.length ? `${media.length} media link${media.length === 1 ? '' : 's'} included` : undefined,
        life: 2500,
      })
      return
    }

    // Bundle recordings into a ZIP alongside the CSV. Pull the audio blobs in
    // parallel; failed downloads degrade gracefully (the row is omitted with
    // a warning, the rest of the export still ships).
    const tuneById = new Map(tunesStore.tunes.map((t) => [t.id, t]))
    const blobs = await Promise.all(
      recordings.map(async (r) => {
        try {
          const blob = await downloadRecordingBlob(r.storage_path)
          return { recording: r, blob, error: null as Error | null }
        } catch (err) {
          return { recording: r, blob: null as Blob | null, error: err instanceof Error ? err : new Error(String(err)) }
        }
      }),
    )
    const failed = blobs.filter((b) => b.error)
    const ok = blobs.filter((b) => b.blob)

    const zip = new JSZip()
    zip.file(`tunes-${today}.csv`, csv)
    const folder = zip.folder('recordings')!
    const usedNames = new Set<string>()
    for (const { recording: r, blob } of ok) {
      if (!blob) continue
      const tune = r.tune_id ? tuneById.get(r.tune_id) : null
      const tuneLabel = tune ? safeFilename(tune.name) : 'unidentified'
      const ext = (r.storage_path.split('.').pop() ?? 'webm').replace(/[^a-z0-9]/gi, '') || 'webm'
      const shortId = r.id.slice(0, 8)
      let name = `${tuneLabel}-${shortId}.${ext}`
      // Defensive: same blob name twice would silently overwrite in the zip.
      let n = 2
      while (usedNames.has(name)) {
        name = `${tuneLabel}-${shortId}-${n}.${ext}`
        n++
      }
      usedNames.add(name)
      folder.file(name, blob)
    }

    const zipBlob = await zip.generateAsync({ type: 'blob' })
    const url = URL.createObjectURL(zipBlob)
    const a = document.createElement('a')
    a.href = url
    a.download = `tunes-${today}.zip`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 1000)

    toast.add({
      severity: 'success',
      summary: `Exported ${tunesStore.tunes.length} tunes`,
      detail: `${ok.length} recording${ok.length === 1 ? '' : 's'} bundled${
        media.length ? `, ${media.length} media link${media.length === 1 ? '' : 's'}` : ''
      }`,
      life: 3000,
    })
    if (failed.length) {
      toast.add({
        severity: 'warn',
        summary: `${failed.length} recording${failed.length === 1 ? '' : 's'} skipped`,
        detail: failed[0].error?.message ?? 'Unknown error',
        life: 6000,
      })
    }
  } catch (e) {
    toast.add({
      severity: 'error',
      summary: 'Export failed',
      detail: e instanceof Error ? e.message : String(e),
      life: 5000,
    })
  } finally {
    exporting.value = false
  }
}

async function handleSave(
  payload: TuneInsert | TuneUpdate,
  isUpdate: boolean,
  mediaRows: NewMediaRow[],
  sources: Source[],
) {
  try {
    if (isUpdate && editingTune.value) {
      await tunesStore.update(editingTune.value.id, payload as TuneUpdate)
      toast.add({ severity: 'success', summary: 'Tune updated', life: 2000 })
      editorOpen.value = false
      return
    }
    if (!auth.user) return
    const result = await createTuneWithAttachments({
      userId: auth.user.id,
      tune: payload as Omit<TuneInsert, 'user_id'>,
      sources,
      media: mediaRows,
    })
    tunesStore.upsert(result.tune)
    reportSaveResult(toast, result)
    editorOpen.value = false
  } catch (e) {
    toast.add({
      severity: 'error',
      summary: 'Save failed',
      detail: e instanceof Error ? e.message : String(e),
      life: 5000,
    })
  }
}

const filtersActive = computed(() => {
  const f = ui.tuneFilters
  return Boolean(f.search || f.status || f.key || f.genre || f.tuning)
})

const activeFilterCount = computed(() => {
  const f = ui.tuneFilters
  let n = 0
  if (f.search.trim()) n++
  if (f.status) n++
  if (f.key) n++
  if (f.genre) n++
  if (f.tuning) n++
  return n
})

const usedSortFields = computed(() => new Set(ui.tuneFilters.sortBy.map((c) => c.field)))

function fieldOptionsForRow(idx: number) {
  const used = new Set(
    ui.tuneFilters.sortBy.map((c, i) => (i === idx ? null : c.field)).filter(Boolean) as SortField[],
  )
  return SORT_FIELDS.filter((f) => !used.has(f.value))
}

const addSortMenuItems = computed(() =>
  SORT_FIELDS.filter((f) => !usedSortFields.value.has(f.value)).map((f) => ({
    label: f.label,
    command: () => ui.addSort(f.value),
  })),
)

function openAddSortMenu(event: Event) {
  addSortMenu.value?.toggle(event)
}
</script>

<template>
  <div class="mx-auto max-w-5xl px-4 py-6 space-y-4">
    <div class="flex items-center justify-between gap-3 flex-wrap">
      <h1 class="text-2xl font-semibold">Tunes</h1>
      <div class="flex items-center gap-2">
        <Button
          severity="secondary"
          outlined
          :disabled="!tunesStore.tunes.length || exporting"
          :loading="exporting"
          aria-label="Export CSV"
          @click="handleExport"
        >
          <i class="pi pi-download sm:mr-2" /><span class="hidden sm:inline">Export CSV</span>
        </Button>
        <Button
          severity="secondary"
          outlined
          aria-label="Import CSV"
          @click="importOpen = true"
        >
          <i class="pi pi-upload sm:mr-2" /><span class="hidden sm:inline">Import CSV</span>
        </Button>
        <Button @click="openAdd"><i class="pi pi-plus mr-2" /> Add tune</Button>
      </div>
    </div>

    <IconField class="sm:hidden">
      <InputIcon class="pi pi-search" />
      <InputText
        ref="searchMobile"
        v-model="ui.tuneFilters.search"
        placeholder="Search name, aka, notes…"
        class="w-full"
        enterkeyhint="search"
        @keydown.enter.prevent="(e: KeyboardEvent) => (e.target as HTMLElement).blur()"
        @keydown.esc.prevent="(e: KeyboardEvent) => (e.target as HTMLElement).blur()"
      />
    </IconField>

    <div class="flex items-center justify-between gap-3 sm:hidden">
      <div class="flex items-center gap-2">
        <Button
          severity="secondary"
          outlined
          size="small"
          :aria-expanded="filtersOpen"
          @click="filtersOpen = !filtersOpen"
        >
          <i class="pi pi-filter mr-2" />
          Filters
          <Badge
            v-if="activeFilterCount"
            :value="activeFilterCount"
            severity="info"
            class="ml-2"
          />
          <i :class="['pi text-xs ml-2', filtersOpen ? 'pi-chevron-up' : 'pi-chevron-down']" />
        </Button>
        <Button
          severity="secondary"
          outlined
          size="small"
          :aria-expanded="sortOpen"
          @click="sortOpen = !sortOpen"
        >
          <i class="pi pi-sort-alt mr-2" />
          Sort
          <Badge
            v-if="ui.tuneFilters.sortBy.length > 1"
            :value="ui.tuneFilters.sortBy.length"
            severity="info"
            class="ml-2"
          />
          <i :class="['pi text-xs ml-2', sortOpen ? 'pi-chevron-up' : 'pi-chevron-down']" />
        </Button>
      </div>
      <span class="text-sm text-surface-500 tabular-nums">
        {{ filtered.length }} of {{ tunesStore.tunes.length }}
      </span>
    </div>

    <div :class="{ 'max-sm:hidden': !filtersOpen }">
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
      <IconField class="lg:col-span-2 max-sm:hidden">
        <InputIcon class="pi pi-search" />
        <InputText
          ref="searchDesktop"
          v-model="ui.tuneFilters.search"
          placeholder="Search name, aka, notes…"
          class="w-full"
          enterkeyhint="search"
          @keydown.enter.prevent="(e: KeyboardEvent) => (e.target as HTMLElement).blur()"
          @keydown.esc.prevent="(e: KeyboardEvent) => (e.target as HTMLElement).blur()"
        />
      </IconField>

      <Select
        v-model="ui.tuneFilters.status"
        :options="STATUS_OPTIONS"
        option-label="label"
        option-value="value"
        placeholder="Any status"
        show-clear
        class="w-full"
      />
      <Select
        v-model="ui.tuneFilters.key"
        :options="keyChoices"
        option-label="label"
        option-value="value"
        placeholder="Any key"
        show-clear
        class="w-full"
      />
      <Select
        v-model="ui.tuneFilters.genre"
        :options="genreChoices"
        option-label="label"
        option-value="value"
        placeholder="Any genre"
        show-clear
        class="w-full"
      />
      <Select
        v-model="ui.tuneFilters.tuning"
        :options="tuningChoices"
        option-label="label"
        option-value="value"
        placeholder="Any tuning"
        show-clear
        class="w-full"
      />
    </div>
    </div>

    <div :class="{ 'max-sm:hidden': !sortOpen }" class="space-y-2">
      <div class="flex items-center justify-between text-sm">
        <span class="text-surface-500 font-medium">Sort</span>
        <div class="flex items-center gap-3 text-surface-500">
          <span class="hidden sm:inline">{{ filtered.length }} of {{ tunesStore.tunes.length }}</span>
          <Button v-if="filtersActive" text size="small" @click="ui.resetTuneFilters()">
            Clear filters
          </Button>
        </div>
      </div>

      <ol class="space-y-1.5">
        <li
          v-for="(c, idx) in ui.tuneFilters.sortBy"
          :key="idx"
          class="flex items-center gap-2 text-sm"
        >
          <span class="w-5 text-center text-surface-400 tabular-nums">{{ idx + 1 }}.</span>
          <Select
            :model-value="c.field"
            :options="fieldOptionsForRow(idx)"
            option-label="label"
            option-value="value"
            class="!min-w-40"
            @update:model-value="(v: SortField) => ui.setSortField(idx, v)"
          />
          <Button
            :icon="c.dir === 'asc' ? 'pi pi-arrow-up' : 'pi pi-arrow-down'"
            severity="secondary"
            text
            rounded
            size="small"
            :aria-label="`Sort ${c.dir === 'asc' ? 'descending' : 'ascending'}`"
            @click="ui.toggleSortDir(idx)"
          />
          <Button
            icon="pi pi-chevron-up"
            severity="secondary"
            text
            rounded
            size="small"
            :disabled="idx === 0"
            aria-label="Move up"
            @click="ui.moveSort(idx, -1)"
          />
          <Button
            icon="pi pi-chevron-down"
            severity="secondary"
            text
            rounded
            size="small"
            :disabled="idx === ui.tuneFilters.sortBy.length - 1"
            aria-label="Move down"
            @click="ui.moveSort(idx, 1)"
          />
          <Button
            icon="pi pi-times"
            severity="secondary"
            text
            rounded
            size="small"
            :disabled="ui.tuneFilters.sortBy.length <= 1"
            aria-label="Remove sort"
            @click="ui.removeSort(idx)"
          />
        </li>
      </ol>

      <div>
        <Button
          severity="secondary"
          text
          size="small"
          :disabled="addSortMenuItems.length === 0"
          @click="openAddSortMenu"
        >
          <i class="pi pi-plus mr-2" /> Add sort
        </Button>
        <Menu ref="addSortMenu" :model="addSortMenuItems" :popup="true" />
      </div>
    </div>

    <div v-if="tunesStore.loading && !tunesStore.initialized" aria-busy="true">
      <div
        v-if="showSkeleton"
        class="border border-surface-200 dark:border-surface-800 rounded-lg overflow-hidden"
      >
        <div
          v-for="i in 6"
          :key="i"
          class="px-4 py-3 border-b border-surface-200 dark:border-surface-800 last:border-b-0 flex items-start justify-between gap-3"
        >
          <div class="min-w-0 flex-1 space-y-2">
            <Skeleton :width="`${50 + ((i * 7) % 30)}%`" height="1rem" />
            <Skeleton :width="`${25 + ((i * 5) % 20)}%`" height="0.75rem" />
          </div>
          <Skeleton width="4.5rem" height="1.25rem" />
        </div>
      </div>
    </div>
    <TuneList v-else :tunes="filtered" :selected-id="selectedId">
      <template #empty>
        <div v-if="!tunesStore.tunes.length" class="py-20 text-center space-y-3">
          <p class="text-surface-500">No tunes yet.</p>
          <div class="flex justify-center gap-2">
            <Button @click="openAdd"><i class="pi pi-plus mr-2" /> Add your first tune</Button>
            <Button severity="secondary" outlined @click="importOpen = true">
              <i class="pi pi-upload mr-2" /> Import CSV
            </Button>
          </div>
        </div>
        <div v-else class="py-16 text-center text-surface-500">
          No tunes match the current filters.
        </div>
      </template>
    </TuneList>

    <Dialog
      v-model:visible="editorOpen"
      :header="editingTune ? 'Edit tune' : 'Add tune'"
      modal
      :style="{ width: 'min(560px, 95vw)' }"
      :dismissable-mask="true"
    >
      <TuneEditor :tune="editingTune" @save="handleSave" @cancel="editorOpen = false" />
    </Dialog>

    <TuneImportDialog v-model:visible="importOpen" />
  </div>
</template>
