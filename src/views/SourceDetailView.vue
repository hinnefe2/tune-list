<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter, RouterLink } from 'vue-router'
import { useToast } from 'primevue/usetoast'
import { useConfirm } from 'primevue/useconfirm'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import { useSourcesStore } from '@/stores/sources'
import { useTunesStore } from '@/stores/tunes'
import { listTunesForSource } from '@/services/tune-sources'
import { getSource, type Source, type SourceInsert, type SourceUpdate } from '@/services/sources'
import SourceEditor from '@/components/SourceEditor.vue'
import { SOURCE_KIND_LABEL, SOURCE_KIND_ICON } from '@/lib/source-options'
import { STATUS_BADGE, STATUS_LABEL } from '@/lib/tune-options'

const props = defineProps<{ id: string }>()

const sourcesStore = useSourcesStore()
const tunesStore = useTunesStore()
const router = useRouter()
const toast = useToast()
const confirm = useConfirm()

const source = ref<Source | null>(null)
const tuneIds = ref<Set<string>>(new Set())
const loading = ref(true)
const editorOpen = ref(false)

async function load() {
  loading.value = true
  try {
    if (!sourcesStore.initialized) await sourcesStore.init()
    if (!tunesStore.initialized) await tunesStore.init()
    source.value = sourcesStore.getById(props.id) ?? (await getSource(props.id))
    const links = await listTunesForSource(props.id)
    tuneIds.value = new Set(links.map((l) => l.tune_id))
  } catch (e) {
    toast.add({
      severity: 'error',
      summary: 'Failed to load source',
      detail: e instanceof Error ? e.message : String(e),
      life: 5000,
    })
  } finally {
    loading.value = false
  }
}

onMounted(load)

const liveSource = computed(() =>
  source.value ? sourcesStore.getById(source.value.id) ?? source.value : null,
)

const tunesHere = computed(() =>
  tunesStore.tunes.filter((t) => tuneIds.value.has(t.id)).slice().sort((a, b) => a.name.localeCompare(b.name)),
)

async function handleSave(payload: SourceInsert | SourceUpdate, isUpdate: boolean) {
  if (!isUpdate || !source.value) return
  try {
    const updated = await sourcesStore.update(source.value.id, payload as SourceUpdate)
    source.value = updated
    editorOpen.value = false
    toast.add({ severity: 'success', summary: 'Source updated', life: 2000 })
  } catch (e) {
    toast.add({
      severity: 'error',
      summary: 'Save failed',
      detail: e instanceof Error ? e.message : String(e),
      life: 5000,
    })
  }
}

function handleDelete() {
  if (!source.value) return
  confirm.require({
    message: `Delete "${source.value.name}"? Linked tunes will be unlinked but kept.`,
    header: 'Delete source',
    icon: 'pi pi-exclamation-triangle',
    rejectLabel: 'Cancel',
    acceptLabel: 'Delete',
    acceptClass: 'p-button-danger',
    accept: async () => {
      if (!source.value) return
      try {
        await sourcesStore.remove(source.value.id)
        toast.add({ severity: 'success', summary: 'Source deleted', life: 2000 })
        router.replace({ name: 'sources' })
      } catch (e) {
        toast.add({
          severity: 'error',
          summary: 'Delete failed',
          detail: e instanceof Error ? e.message : String(e),
          life: 5000,
        })
      }
    },
  })
}
</script>

<template>
  <div class="mx-auto max-w-3xl px-4 py-6 space-y-6">
    <div class="text-sm text-surface-500">
      <button class="hover:underline" @click="router.push({ name: 'sources' })">
        <i class="pi pi-arrow-left mr-1" /> All sources
      </button>
    </div>

    <div v-if="loading" class="py-16 text-center text-surface-500">
      <i class="pi pi-spin pi-spinner mr-2" /> Loading…
    </div>

    <div v-else-if="!liveSource" class="py-16 text-center space-y-3">
      <p class="text-surface-500">Source not found.</p>
      <Button text @click="router.push({ name: 'sources' })">Back to sources</Button>
    </div>

    <template v-else>
      <header class="space-y-1">
        <h1 class="text-3xl font-semibold tracking-tight flex items-center gap-2">
          <i :class="[SOURCE_KIND_ICON[liveSource.kind], 'text-surface-400']" />
          {{ liveSource.name }}
        </h1>
        <div class="text-sm text-surface-500">
          {{ SOURCE_KIND_LABEL[liveSource.kind] }}<template v-if="liveSource.occurred_on"> · {{ liveSource.occurred_on }}</template>
        </div>
      </header>

      <section v-if="liveSource.notes" class="space-y-1">
        <h2 class="text-sm font-medium text-surface-500">Notes</h2>
        <p class="whitespace-pre-wrap">{{ liveSource.notes }}</p>
      </section>

      <section class="space-y-2">
        <h2 class="text-sm font-medium text-surface-500">
          Tunes heard here ({{ tunesHere.length }})
        </h2>
        <div v-if="!tunesHere.length" class="text-sm text-surface-500 py-4">
          No tunes linked to this source yet.
        </div>
        <ul v-else class="border border-surface-200 dark:border-surface-800 rounded-lg overflow-hidden">
          <li
            v-for="t in tunesHere"
            :key="t.id"
            class="border-b border-surface-200 dark:border-surface-800 last:border-b-0"
          >
            <RouterLink
              :to="{ name: 'tune-detail', params: { id: t.id } }"
              class="flex items-center justify-between gap-3 px-4 py-3 hover:bg-surface-50 dark:hover:bg-surface-900"
            >
              <div class="min-w-0">
                <div class="font-medium truncate">{{ t.name }}</div>
                <div class="text-xs text-surface-500">
                  {{ t.key ?? '—' }}<template v-if="t.tuning && t.tuning !== 'GDAE'"> · {{ t.tuning }}</template>
                </div>
              </div>
              <span
                :class="[
                  'shrink-0 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium',
                  STATUS_BADGE[t.status],
                ]"
              >
                {{ STATUS_LABEL[t.status] }}
              </span>
            </RouterLink>
          </li>
        </ul>
      </section>

      <div class="flex justify-end gap-2 pt-4 border-t border-surface-200 dark:border-surface-800">
        <Button severity="danger" text @click="handleDelete">
          <i class="pi pi-trash mr-2" /> Delete
        </Button>
        <Button @click="editorOpen = true">
          <i class="pi pi-pencil mr-2" /> Edit
        </Button>
      </div>

      <Dialog
        v-model:visible="editorOpen"
        header="Edit source"
        modal
        :style="{ width: 'min(520px, 95vw)' }"
        :dismissable-mask="true"
      >
        <SourceEditor :source="liveSource" @save="handleSave" @cancel="editorOpen = false" />
      </Dialog>
    </template>
  </div>
</template>
