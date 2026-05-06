<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useToast } from 'primevue/usetoast'
import { useConfirm } from 'primevue/useconfirm'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import { useTunesStore } from '@/stores/tunes'
import { getTune, type Tune, type TuneInsert, type TuneUpdate } from '@/services/tunes'
import { STATUS_BADGE, STATUS_LABEL } from '@/lib/tune-options'
import TuneEditor from '@/components/TuneEditor.vue'

const props = defineProps<{ id: string }>()

const tunesStore = useTunesStore()
const router = useRouter()
const toast = useToast()
const confirm = useConfirm()

const tune = ref<Tune | null>(null)
const loading = ref(true)
const editorOpen = ref(false)

async function load() {
  loading.value = true
  try {
    if (!tunesStore.initialized) await tunesStore.init()
    const fromStore = tunesStore.getById(props.id)
    if (fromStore) {
      tune.value = fromStore
    } else {
      tune.value = await getTune(props.id)
    }
  } catch (e) {
    toast.add({
      severity: 'error',
      summary: 'Failed to load tune',
      detail: e instanceof Error ? e.message : String(e),
      life: 5000,
    })
  } finally {
    loading.value = false
  }
}

onMounted(load)

// Reflect realtime updates from the store onto this view.
const liveTune = computed(() => (tune.value ? tunesStore.getById(tune.value.id) ?? tune.value : null))

async function handleSave(payload: TuneInsert | TuneUpdate, isUpdate: boolean) {
  if (!isUpdate || !tune.value) return
  try {
    const updated = await tunesStore.update(tune.value.id, payload as TuneUpdate)
    tune.value = updated
    editorOpen.value = false
    toast.add({ severity: 'success', summary: 'Tune updated', life: 2000 })
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
  if (!tune.value) return
  confirm.require({
    message: `Delete "${tune.value.name}"? This can't be undone.`,
    header: 'Delete tune',
    icon: 'pi pi-exclamation-triangle',
    rejectLabel: 'Cancel',
    acceptLabel: 'Delete',
    acceptClass: 'p-button-danger',
    accept: async () => {
      if (!tune.value) return
      try {
        await tunesStore.remove(tune.value.id)
        toast.add({ severity: 'success', summary: 'Tune deleted', life: 2000 })
        router.replace({ name: 'tunes' })
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
    <div class="flex items-center gap-2 text-sm text-surface-500">
      <button class="hover:underline" @click="router.push({ name: 'tunes' })">
        <i class="pi pi-arrow-left mr-1" /> All tunes
      </button>
    </div>

    <div v-if="loading" class="py-16 text-center text-surface-500">
      <i class="pi pi-spin pi-spinner mr-2" /> Loading…
    </div>

    <div v-else-if="!liveTune" class="py-16 text-center space-y-3">
      <p class="text-surface-500">Tune not found.</p>
      <Button text @click="router.push({ name: 'tunes' })">Back to tunes</Button>
    </div>

    <template v-else>
      <header class="space-y-2">
        <div class="flex items-start justify-between gap-3">
          <h1 class="text-3xl font-semibold tracking-tight">{{ liveTune.name }}</h1>
          <span
            :class="[
              'shrink-0 inline-flex items-center px-2.5 py-1 rounded text-xs font-medium',
              STATUS_BADGE[liveTune.status],
            ]"
          >
            {{ STATUS_LABEL[liveTune.status] }}
          </span>
        </div>
        <div v-if="liveTune.aka.length" class="text-sm text-surface-500">
          aka {{ liveTune.aka.join(', ') }}
        </div>
      </header>

      <dl class="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-2 text-sm">
        <dt class="text-surface-500">Key</dt>
        <dd>{{ liveTune.key ?? '—' }}</dd>
        <template v-if="liveTune.alt_keys.length">
          <dt class="text-surface-500">Alt keys</dt>
          <dd>{{ liveTune.alt_keys.join(', ') }}</dd>
        </template>
        <dt class="text-surface-500">Tuning</dt>
        <dd>{{ liveTune.tuning }}</dd>
        <template v-if="liveTune.genre">
          <dt class="text-surface-500">Genre</dt>
          <dd>{{ liveTune.genre }}</dd>
        </template>
      </dl>

      <section v-if="liveTune.notes" class="space-y-1">
        <h2 class="text-sm font-medium text-surface-500">Notes</h2>
        <p class="whitespace-pre-wrap">{{ liveTune.notes }}</p>
      </section>

      <section class="text-sm text-surface-500 space-y-1 border-t border-surface-200 dark:border-surface-800 pt-4">
        <p class="text-surface-400">Sources, media, and practice cards arrive in later phases.</p>
      </section>

      <div class="flex justify-end gap-2 pt-4">
        <Button severity="danger" text @click="handleDelete">
          <i class="pi pi-trash mr-2" /> Delete
        </Button>
        <Button @click="editorOpen = true">
          <i class="pi pi-pencil mr-2" /> Edit
        </Button>
      </div>

      <Dialog
        v-model:visible="editorOpen"
        header="Edit tune"
        modal
        :style="{ width: 'min(560px, 95vw)' }"
        :dismissable-mask="true"
      >
        <TuneEditor :tune="liveTune" @save="handleSave" @cancel="editorOpen = false" />
      </Dialog>
    </template>
  </div>
</template>
