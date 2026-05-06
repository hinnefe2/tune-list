<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'
import Textarea from 'primevue/textarea'
import Select from 'primevue/select'
import Button from 'primevue/button'
import FileUpload, { type FileUploadSelectEvent } from 'primevue/fileupload'
import type { MediaLink, MediaLinkInsert, MediaLinkUpdate, MediaKind } from '@/services/media'
import { MEDIA_KIND_OPTIONS, inferKindFromUrl } from '@/lib/media-helpers'
import { uploadScore, deleteScore } from '@/services/storage'
import { useAuthStore } from '@/stores/auth'

interface Form {
  kind: MediaKind
  url: string
  storage_path: string | null
  title: string | null
  section: string | null
  start_seconds: number | null
  end_seconds: number | null
  notes: string | null
}

const props = defineProps<{ media: MediaLink | null; tuneId: string }>()
const emit = defineEmits<{
  save: [payload: MediaLinkInsert | MediaLinkUpdate, isUpdate: boolean]
  cancel: []
}>()

const auth = useAuthStore()

const blank = (): Form => ({
  kind: 'video',
  url: '',
  storage_path: null,
  title: null,
  section: null,
  start_seconds: null,
  end_seconds: null,
  notes: null,
})

const form = ref<Form>(blank())
const submitting = ref(false)
const uploading = ref(false)
const errorMsg = ref<string | null>(null)

watch(
  () => props.media,
  (m) => {
    errorMsg.value = null
    if (!m) {
      form.value = blank()
      return
    }
    form.value = {
      kind: m.kind,
      url: m.url ?? '',
      storage_path: m.storage_path,
      title: m.title,
      section: m.section,
      start_seconds: m.start_seconds === null ? null : Number(m.start_seconds),
      end_seconds: m.end_seconds === null ? null : Number(m.end_seconds),
      notes: m.notes,
    }
  },
  { immediate: true },
)

// Auto-classify URL on paste so the user usually doesn't need to touch the kind dropdown.
let lastTypedUrl = ''
watch(
  () => form.value.url,
  (url) => {
    if (!url) return
    if (url === lastTypedUrl) return
    lastTypedUrl = url
    if (!props.media) {
      // Only auto-set kind on add; don't override the user's existing pick on edit.
      const inferred = inferKindFromUrl(url)
      if (inferred !== 'other') form.value.kind = inferred
    }
  },
)

async function handleFileSelect(event: FileUploadSelectEvent) {
  const f = (Array.isArray(event.files) ? event.files[0] : event.files) as File | undefined
  if (!f || !auth.user) return
  uploading.value = true
  errorMsg.value = null
  try {
    // If we replace an existing upload, clean up the old one in best-effort fashion.
    const prev = form.value.storage_path
    const path = await uploadScore(auth.user.id, f)
    form.value.storage_path = path
    form.value.url = ''
    form.value.kind = 'sheet_music'
    if (prev && prev !== path) {
      try {
        await deleteScore(prev)
      } catch {
        /* not critical */
      }
    }
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : String(e)
  } finally {
    uploading.value = false
  }
}

const hasUrl = computed(() => form.value.url.trim().length > 0)
const hasStoragePath = computed(() => Boolean(form.value.storage_path))

function clearUpload() {
  form.value.storage_path = null
}

async function handleSubmit() {
  errorMsg.value = null
  if (hasUrl.value === hasStoragePath.value) {
    errorMsg.value = hasUrl.value
      ? 'Provide either a URL or an upload — not both.'
      : 'Provide a URL or upload a sheet music image.'
    return
  }
  submitting.value = true
  try {
    const payload = {
      tune_id: props.tuneId,
      kind: form.value.kind,
      url: hasUrl.value ? form.value.url.trim() : null,
      storage_path: hasStoragePath.value ? form.value.storage_path : null,
      title: form.value.title?.trim() || null,
      section: form.value.section?.trim() || null,
      start_seconds: form.value.start_seconds,
      end_seconds: form.value.end_seconds,
      notes: form.value.notes?.trim() || null,
    }
    emit('save', payload, props.media !== null)
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : String(e)
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <form class="space-y-4" @submit.prevent="handleSubmit">
    <div class="space-y-1">
      <label class="block text-sm font-medium">Kind</label>
      <Select
        v-model="form.kind"
        :options="MEDIA_KIND_OPTIONS"
        option-label="label"
        option-value="value"
        class="w-full"
      />
    </div>

    <div class="space-y-1">
      <label class="block text-sm font-medium">URL</label>
      <InputText
        v-model="form.url"
        :placeholder="hasStoragePath ? 'Using uploaded file' : 'https://…'"
        class="w-full"
        :disabled="hasStoragePath"
        autocapitalize="off"
        autocomplete="off"
      />
    </div>

    <div class="space-y-2 rounded border border-surface-200 dark:border-surface-800 p-3">
      <div class="text-sm font-medium">Or upload a sheet music image</div>
      <div class="flex items-center gap-3">
        <FileUpload
          mode="basic"
          accept="image/*,.pdf"
          :auto="false"
          :show-upload-button="false"
          :choose-label="hasStoragePath ? 'Replace file' : 'Choose file'"
          custom-upload
          :disabled="uploading"
          @select="handleFileSelect"
        />
        <span v-if="uploading" class="text-sm text-surface-500">
          <i class="pi pi-spin pi-spinner mr-2" /> Uploading…
        </span>
        <Button
          v-else-if="hasStoragePath"
          severity="secondary"
          text
          size="small"
          @click="clearUpload"
        >
          <i class="pi pi-times mr-1" /> Remove upload
        </Button>
      </div>
      <p v-if="hasStoragePath" class="text-xs text-surface-500 break-all">{{ form.storage_path }}</p>
    </div>

    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div class="space-y-1">
        <label class="block text-sm font-medium">Title</label>
        <InputText v-model="form.title" class="w-full" placeholder="Optional" />
      </div>
      <div class="space-y-1">
        <label class="block text-sm font-medium">Section</label>
        <InputText v-model="form.section" class="w-full" placeholder="A, B, intro…" />
      </div>
      <div class="space-y-1">
        <label class="block text-sm font-medium">Start (sec)</label>
        <InputNumber v-model="form.start_seconds" :min="0" class="w-full" :input-class="'w-full'" />
      </div>
      <div class="space-y-1">
        <label class="block text-sm font-medium">End (sec)</label>
        <InputNumber v-model="form.end_seconds" :min="0" class="w-full" :input-class="'w-full'" />
      </div>
    </div>

    <div class="space-y-1">
      <label class="block text-sm font-medium">Notes</label>
      <Textarea v-model="form.notes" class="w-full" rows="2" auto-resize />
    </div>

    <p v-if="errorMsg" class="text-sm text-red-600 dark:text-red-400">{{ errorMsg }}</p>

    <div class="flex justify-end gap-2 pt-2">
      <Button type="button" severity="secondary" text :disabled="submitting" @click="emit('cancel')">
        Cancel
      </Button>
      <Button type="submit" :loading="submitting">
        {{ media ? 'Save changes' : 'Add media' }}
      </Button>
    </div>
  </form>
</template>
