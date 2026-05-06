<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter, RouterLink } from 'vue-router'
import { useToast } from 'primevue/usetoast'
import { useConfirm } from 'primevue/useconfirm'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import { useTunesStore } from '@/stores/tunes'
import { useAuthStore } from '@/stores/auth'
import { getTune, type Tune, type TuneInsert, type TuneUpdate } from '@/services/tunes'
import { STATUS_BADGE, STATUS_LABEL } from '@/lib/tune-options'
import TuneEditor from '@/components/TuneEditor.vue'
import SourcePicker from '@/components/SourcePicker.vue'
import MediaEmbed from '@/components/MediaEmbed.vue'
import MediaEditor from '@/components/MediaEditor.vue'
import {
  listTuneSources,
  linkTuneSource,
  unlinkTuneSource,
  type TuneSourceWithSource,
} from '@/services/tune-sources'
import {
  listMediaForTune,
  createMediaLink,
  updateMediaLink,
  deleteMediaLink,
  type MediaLink,
  type MediaLinkInsert,
  type MediaLinkUpdate,
} from '@/services/media'
import { SOURCE_KIND_ICON } from '@/lib/source-options'
import { MEDIA_KIND_LABEL } from '@/lib/media-helpers'
import type { Source } from '@/services/sources'

const props = defineProps<{ id: string }>()

const tunesStore = useTunesStore()
const auth = useAuthStore()
const router = useRouter()
const toast = useToast()
const confirm = useConfirm()

const tune = ref<Tune | null>(null)
const tuneSources = ref<TuneSourceWithSource[]>([])
const mediaLinks = ref<MediaLink[]>([])
const loading = ref(true)
const editorOpen = ref(false)
const mediaEditorOpen = ref(false)
const editingMedia = ref<MediaLink | null>(null)

async function load() {
  loading.value = true
  try {
    if (!tunesStore.initialized) await tunesStore.init()
    const fromStore = tunesStore.getById(props.id)
    tune.value = fromStore ?? (await getTune(props.id))
    if (tune.value) {
      const [ts, ml] = await Promise.all([
        listTuneSources(tune.value.id),
        listMediaForTune(tune.value.id),
      ])
      tuneSources.value = ts
      mediaLinks.value = ml
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

const liveTune = computed(() => (tune.value ? tunesStore.getById(tune.value.id) ?? tune.value : null))

const linkedSourceIds = computed(() => tuneSources.value.map((ts) => ts.source_id))

async function handleSave(payload: TuneInsert | TuneUpdate, isUpdate: boolean) {
  // Edit mode here doesn't surface inline media rows; the third emit arg
  // (always []) is intentionally ignored — media is managed below.
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

async function handleSourceSelected(source: Source) {
  if (!tune.value || !auth.user) return
  if (linkedSourceIds.value.includes(source.id)) return
  try {
    const link = await linkTuneSource({
      user_id: auth.user.id,
      tune_id: tune.value.id,
      source_id: source.id,
      heard_on: null,
      notes: null,
    })
    tuneSources.value = [...tuneSources.value, link]
    toast.add({ severity: 'success', summary: `Linked to ${source.name}`, life: 2000 })
  } catch (e) {
    toast.add({
      severity: 'error',
      summary: 'Link failed',
      detail: e instanceof Error ? e.message : String(e),
      life: 5000,
    })
  }
}

function unlinkSource(link: TuneSourceWithSource) {
  confirm.require({
    message: `Remove "${link.source.name}" as a source for this tune? The source itself stays.`,
    header: 'Unlink source',
    icon: 'pi pi-exclamation-triangle',
    rejectLabel: 'Cancel',
    acceptLabel: 'Unlink',
    accept: async () => {
      try {
        await unlinkTuneSource(link.id)
        tuneSources.value = tuneSources.value.filter((t) => t.id !== link.id)
      } catch (e) {
        toast.add({
          severity: 'error',
          summary: 'Unlink failed',
          detail: e instanceof Error ? e.message : String(e),
          life: 5000,
        })
      }
    },
  })
}

function openAddMedia() {
  editingMedia.value = null
  mediaEditorOpen.value = true
}

function openEditMedia(m: MediaLink) {
  editingMedia.value = m
  mediaEditorOpen.value = true
}

async function handleMediaSave(payload: MediaLinkInsert | MediaLinkUpdate, isUpdate: boolean) {
  if (!tune.value || !auth.user) return
  try {
    if (isUpdate && editingMedia.value) {
      const updated = await updateMediaLink(editingMedia.value.id, payload as MediaLinkUpdate)
      mediaLinks.value = mediaLinks.value.map((m) => (m.id === updated.id ? updated : m))
      toast.add({ severity: 'success', summary: 'Media updated', life: 2000 })
    } else {
      const created = await createMediaLink({
        ...(payload as MediaLinkInsert),
        user_id: auth.user.id,
      })
      mediaLinks.value = [...mediaLinks.value, created]
      toast.add({ severity: 'success', summary: 'Media added', life: 2000 })
    }
    mediaEditorOpen.value = false
  } catch (e) {
    toast.add({
      severity: 'error',
      summary: 'Save failed',
      detail: e instanceof Error ? e.message : String(e),
      life: 5000,
    })
  }
}

function deleteMedia(m: MediaLink) {
  confirm.require({
    message: `Delete this ${MEDIA_KIND_LABEL[m.kind]} link?`,
    header: 'Delete media',
    icon: 'pi pi-exclamation-triangle',
    rejectLabel: 'Cancel',
    acceptLabel: 'Delete',
    acceptClass: 'p-button-danger',
    accept: async () => {
      try {
        await deleteMediaLink(m.id)
        mediaLinks.value = mediaLinks.value.filter((x) => x.id !== m.id)
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

      <section class="space-y-3 border-t border-surface-200 dark:border-surface-800 pt-5">
        <h2 class="text-sm font-medium text-surface-500">Heard at</h2>
        <ul v-if="tuneSources.length" class="space-y-1">
          <li
            v-for="link in tuneSources"
            :key="link.id"
            class="flex items-center gap-2 text-sm"
          >
            <i :class="[SOURCE_KIND_ICON[link.source.kind], 'text-surface-400']" />
            <RouterLink
              :to="{ name: 'source-detail', params: { id: link.source.id } }"
              class="hover:underline"
            >
              {{ link.source.name }}
            </RouterLink>
            <Button
              icon="pi pi-times"
              severity="secondary"
              text
              rounded
              size="small"
              aria-label="Unlink source"
              @click="unlinkSource(link)"
            />
          </li>
        </ul>
        <SourcePicker
          placeholder="Link a source…"
          :exclude-ids="linkedSourceIds"
          @select="handleSourceSelected"
        />
      </section>

      <section class="space-y-3 border-t border-surface-200 dark:border-surface-800 pt-5">
        <div class="flex items-center justify-between">
          <h2 class="text-sm font-medium text-surface-500">Media</h2>
          <Button size="small" severity="secondary" outlined @click="openAddMedia">
            <i class="pi pi-plus mr-2" /> Add media
          </Button>
        </div>
        <div v-if="!mediaLinks.length" class="text-sm text-surface-500 py-2">
          No media linked yet.
        </div>
        <ul v-else class="space-y-6">
          <li
            v-for="m in mediaLinks"
            :key="m.id"
            class="border border-surface-200 dark:border-surface-800 rounded p-3 space-y-2"
          >
            <div class="flex items-center justify-between gap-2 text-xs text-surface-500">
              <span class="uppercase tracking-wider">{{ MEDIA_KIND_LABEL[m.kind] }}</span>
              <div class="flex items-center gap-1">
                <Button icon="pi pi-pencil" text rounded size="small" aria-label="Edit" @click="openEditMedia(m)" />
                <Button icon="pi pi-trash" text rounded size="small" severity="danger" aria-label="Delete" @click="deleteMedia(m)" />
              </div>
            </div>
            <MediaEmbed :media="m" />
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
        header="Edit tune"
        modal
        :style="{ width: 'min(560px, 95vw)' }"
        :dismissable-mask="true"
      >
        <TuneEditor :tune="liveTune" @save="handleSave" @cancel="editorOpen = false" />
      </Dialog>

      <Dialog
        v-model:visible="mediaEditorOpen"
        :header="editingMedia ? 'Edit media' : 'Add media'"
        modal
        :style="{ width: 'min(560px, 95vw)' }"
        :dismissable-mask="true"
      >
        <MediaEditor
          :media="editingMedia"
          :tune-id="liveTune.id"
          @save="handleMediaSave"
          @cancel="mediaEditorOpen = false"
        />
      </Dialog>
    </template>
  </div>
</template>
