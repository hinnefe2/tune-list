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
import {
  listRecordingsForTune,
  createRecording,
  deleteRecordingRow,
  type Recording,
} from '@/services/recordings'
import { uploadRecording, deleteRecording } from '@/services/storage'
import RecordingEmbed from '@/components/RecordingEmbed.vue'
import AudioRecorder from '@/components/AudioRecorder.vue'
import type { RecorderResult } from '@/composables/useAudioRecorder'
import { listCardsForTune, setCardEnabled, type Card } from '@/services/cards'
import { SOURCE_KIND_ICON } from '@/lib/source-options'
import { MEDIA_KIND_LABEL } from '@/lib/media-helpers'
import { CARD_KIND_META, type CardKind } from '@/lib/card-options'
import type { Source } from '@/services/sources'
import ToggleSwitch from 'primevue/toggleswitch'
import Skeleton from 'primevue/skeleton'
import { useDelayed } from '@/composables/useDelayed'

const props = defineProps<{ id: string }>()

const tunesStore = useTunesStore()
const auth = useAuthStore()
const router = useRouter()
const toast = useToast()
const confirm = useConfirm()

const tune = ref<Tune | null>(null)
const tuneSources = ref<TuneSourceWithSource[]>([])
const mediaLinks = ref<MediaLink[]>([])
const recordings = ref<Recording[]>([])
const cards = ref<Card[]>([])
const loading = ref(true)
const editorOpen = ref(false)
const mediaEditorOpen = ref(false)
const editingMedia = ref<MediaLink | null>(null)
const recorderOpen = ref(false)
const stagedRecording = ref<RecorderResult | null>(null)
const savingRecording = ref(false)
const showSkeleton = useDelayed(loading)

async function load() {
  loading.value = true
  try {
    if (!tunesStore.initialized) await tunesStore.init()
    const fromStore = tunesStore.getById(props.id)
    tune.value = fromStore ?? (await getTune(props.id))
    if (tune.value) {
      const [ts, ml, rs, cs] = await Promise.all([
        listTuneSources(tune.value.id),
        listMediaForTune(tune.value.id),
        listRecordingsForTune(tune.value.id),
        listCardsForTune(tune.value.id),
      ])
      tuneSources.value = ts
      mediaLinks.value = ml
      recordings.value = rs
      cards.value = cs
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

function getCardForKind(kind: CardKind): Card | null {
  return cards.value.find((c) => c.kind === kind) ?? null
}

async function handleCardToggle(kind: CardKind, enabled: boolean) {
  if (!tune.value || !auth.user) return
  const existing = getCardForKind(kind)
  // No-op disable on a non-existent card.
  if (!existing && !enabled) return
  try {
    const updated = await setCardEnabled(tune.value.id, auth.user.id, kind, enabled, existing)
    if (existing) {
      cards.value = cards.value.map((c) => (c.id === updated.id ? updated : c))
    } else {
      cards.value = [...cards.value, updated]
    }
  } catch (e) {
    toast.add({
      severity: 'error',
      summary: 'Failed to update card',
      detail: e instanceof Error ? e.message : String(e),
      life: 5000,
    })
  }
}

function openRecorder() {
  stagedRecording.value = null
  recorderOpen.value = true
}

function closeRecorder() {
  stagedRecording.value = null
  recorderOpen.value = false
}

async function saveStagedRecording() {
  if (!stagedRecording.value || !tune.value || !auth.user) return
  savingRecording.value = true
  try {
    const rec = stagedRecording.value
    const path = await uploadRecording(auth.user.id, rec.blob, rec.ext)
    const created = await createRecording({
      user_id: auth.user.id,
      tune_id: tune.value.id,
      source_id: null,
      storage_path: path,
      duration_seconds: rec.durationSeconds,
    })
    recordings.value = [created, ...recordings.value]
    toast.add({ severity: 'success', summary: 'Recording saved', life: 2000 })
    closeRecorder()
  } catch (e) {
    toast.add({
      severity: 'error',
      summary: 'Save failed',
      detail: e instanceof Error ? e.message : String(e),
      life: 5000,
    })
  } finally {
    savingRecording.value = false
  }
}

function deleteRecordingItem(r: Recording) {
  confirm.require({
    message: 'Delete this recording? This can\'t be undone.',
    header: 'Delete recording',
    icon: 'pi pi-exclamation-triangle',
    rejectLabel: 'Cancel',
    acceptLabel: 'Delete',
    acceptClass: 'p-button-danger',
    accept: async () => {
      try {
        await deleteRecordingRow(r.id)
        // Storage cleanup is best-effort; the row is gone either way.
        try {
          await deleteRecording(r.storage_path)
        } catch {
          /* ignore */
        }
        recordings.value = recordings.value.filter((x) => x.id !== r.id)
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

    <div v-if="loading" aria-busy="true">
      <div v-if="showSkeleton" class="space-y-6">
        <div class="flex items-start justify-between gap-3">
          <Skeleton width="60%" height="2.25rem" />
          <Skeleton width="5rem" height="1.5rem" />
        </div>
        <div class="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-2.5">
          <Skeleton width="3rem" height="1rem" />
          <Skeleton width="6rem" height="1rem" />
          <Skeleton width="3.5rem" height="1rem" />
          <Skeleton width="4.5rem" height="1rem" />
          <Skeleton width="3rem" height="1rem" />
          <Skeleton width="5rem" height="1rem" />
        </div>
        <div class="space-y-2">
          <Skeleton width="20%" height="0.875rem" />
          <Skeleton width="100%" height="1rem" />
          <Skeleton width="85%" height="1rem" />
        </div>
      </div>
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

      <section class="space-y-3 border-t border-surface-200 dark:border-surface-800 pt-5">
        <div class="flex items-center justify-between">
          <h2 class="text-sm font-medium text-surface-500">Recordings</h2>
          <Button size="small" severity="secondary" outlined @click="openRecorder">
            <i class="pi pi-microphone mr-2" /> Record
          </Button>
        </div>
        <div v-if="!recordings.length" class="text-sm text-surface-500 py-2">
          No recordings yet.
        </div>
        <ul v-else class="space-y-4">
          <li
            v-for="r in recordings"
            :key="r.id"
            class="border border-surface-200 dark:border-surface-800 rounded p-3 space-y-2"
          >
            <div class="flex items-center justify-end">
              <Button
                icon="pi pi-trash"
                text
                rounded
                size="small"
                severity="danger"
                aria-label="Delete recording"
                @click="deleteRecordingItem(r)"
              />
            </div>
            <RecordingEmbed :recording="r" />
          </li>
        </ul>
      </section>

      <section class="space-y-3 border-t border-surface-200 dark:border-surface-800 pt-5">
        <h2 class="text-sm font-medium text-surface-500">Practice cards</h2>
        <p v-if="liveTune.status !== 'learning'" class="text-xs text-surface-500">
          Default cards (A part, B part, key) auto-generate when a tune moves to <span class="font-medium">Learning</span>.
          Toggle additional kinds here.
        </p>
        <ul class="divide-y divide-surface-200 dark:divide-surface-800 border border-surface-200 dark:border-surface-800 rounded-lg">
          <li
            v-for="meta in CARD_KIND_META"
            :key="meta.value"
            class="flex items-center justify-between gap-3 px-3 py-2"
          >
            <div class="min-w-0">
              <div class="text-sm font-medium">{{ meta.label }}</div>
              <div class="text-xs text-surface-500 truncate">{{ meta.description }}</div>
            </div>
            <ToggleSwitch
              :model-value="getCardForKind(meta.value)?.enabled ?? false"
              @update:model-value="(v: boolean) => handleCardToggle(meta.value, v)"
            />
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

      <Dialog
        v-model:visible="recorderOpen"
        header="Record audio"
        modal
        :style="{ width: 'min(480px, 95vw)' }"
        :dismissable-mask="!savingRecording"
        :closable="!savingRecording"
        @hide="closeRecorder"
      >
        <div class="space-y-4">
          <AudioRecorder v-model:result="stagedRecording" compact />
          <div class="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              severity="secondary"
              text
              :disabled="savingRecording"
              @click="closeRecorder"
            >
              Cancel
            </Button>
            <Button
              type="button"
              :disabled="!stagedRecording"
              :loading="savingRecording"
              @click="saveStagedRecording"
            >
              Save recording
            </Button>
          </div>
        </div>
      </Dialog>
    </template>
  </div>
</template>
