<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import InputText from 'primevue/inputtext'
import Textarea from 'primevue/textarea'
import Select from 'primevue/select'
import InputChips from 'primevue/inputchips'
import Button from 'primevue/button'
import type { Tune, TuneInsert, TuneUpdate } from '@/services/tunes'
import type { MediaKind } from '@/services/media'
import type { Source } from '@/services/sources'
import type { TuneSourceWithSource } from '@/services/tune-sources'
import {
  COMMON_KEYS,
  COMMON_TUNINGS,
  STATUS_OPTIONS,
} from '@/lib/tune-options'
import { MEDIA_KIND_OPTIONS, inferKindFromUrl } from '@/lib/media-helpers'
import { SOURCE_KIND_ICON } from '@/lib/source-options'
import SourcePicker from '@/components/SourcePicker.vue'

interface Form {
  name: string
  aka: string[]
  key: string | null
  alt_keys: string[]
  tuning: string
  genre: string | null
  status: TuneInsert['status']
  notes: string | null
}

export interface NewMediaRow {
  kind: MediaKind
  url: string
}

const props = defineProps<{
  tune: Tune | null
  tuneSources?: TuneSourceWithSource[]
}>()
const emit = defineEmits<{
  save: [payload: TuneInsert | TuneUpdate, isUpdate: boolean, mediaRows: NewMediaRow[]]
  cancel: []
  'link-source': [source: Source]
  'unlink-source': [link: TuneSourceWithSource]
}>()

const blank = (): Form => ({
  name: '',
  aka: [],
  key: null,
  alt_keys: [],
  tuning: 'GDAE',
  genre: null,
  status: 'wishlist',
  notes: null,
})

const form = ref<Form>(blank())
const mediaRows = ref<NewMediaRow[]>([])
const submitting = ref(false)
const errorMsg = ref<string | null>(null)

const isAdd = computed(() => props.tune === null)
const linkedSourceIds = computed(() =>
  (props.tuneSources ?? []).map((ts) => ts.source_id),
)

watch(
  () => props.tune,
  (t) => {
    errorMsg.value = null
    mediaRows.value = []
    if (!t) {
      form.value = blank()
      return
    }
    form.value = {
      name: t.name,
      aka: t.aka ?? [],
      key: t.key,
      alt_keys: t.alt_keys ?? [],
      tuning: t.tuning,
      genre: t.genre,
      status: t.status,
      notes: t.notes,
    }
  },
  { immediate: true },
)

const keyOptions = COMMON_KEYS.map((k) => ({ value: k, label: k }))
const tuningOptions = COMMON_TUNINGS.map((t) => ({ value: t, label: t }))

function addMediaRow() {
  mediaRows.value.push({ kind: 'video', url: '' })
}

function removeMediaRow(idx: number) {
  mediaRows.value.splice(idx, 1)
}

function onMediaUrlInput(idx: number, value: string) {
  const row = mediaRows.value[idx]
  if (!row) return
  row.url = value
  // Whenever the URL points at a recognized platform (YouTube, Spotify,
  // looptube), set the kind from it. The Type select stays editable for
  // anything we can't infer.
  if (value) {
    const inferred = inferKindFromUrl(value)
    if (inferred !== 'other') row.kind = inferred
  }
}

async function handleSubmit() {
  errorMsg.value = null
  if (!form.value.name.trim()) {
    errorMsg.value = 'Name is required.'
    return
  }
  // Drop empty media rows; reject malformed URLs.
  const cleanedMedia = mediaRows.value
    .map((r) => ({ kind: r.kind, url: r.url.trim() }))
    .filter((r) => r.url.length > 0)
  for (const r of cleanedMedia) {
    try {
      // eslint-disable-next-line no-new
      new URL(r.url)
    } catch {
      errorMsg.value = `"${r.url}" doesn't look like a valid URL.`
      return
    }
  }

  submitting.value = true
  try {
    const payload = {
      name: form.value.name.trim(),
      aka: form.value.aka,
      key: form.value.key,
      alt_keys: form.value.alt_keys,
      tuning: form.value.tuning,
      genre: form.value.genre,
      status: form.value.status,
      notes: form.value.notes?.trim() || null,
    }
    emit('save', payload, props.tune !== null, cleanedMedia)
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
      <label class="block text-sm font-medium">Name</label>
      <InputText
        v-model="form.name"
        autofocus
        class="w-full"
        placeholder="Big John McNeil"
        autocapitalize="words"
        autocomplete="off"
      />
    </div>

    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div class="space-y-1">
        <label class="block text-sm font-medium">Status</label>
        <Select
          v-model="form.status"
          :options="STATUS_OPTIONS"
          option-label="label"
          option-value="value"
          class="w-full"
        />
      </div>

      <div class="space-y-1">
        <label class="block text-sm font-medium">Tuning</label>
        <Select
          v-model="form.tuning"
          :options="tuningOptions"
          option-label="label"
          option-value="value"
          editable
          class="w-full"
        />
      </div>

      <div class="space-y-1">
        <label class="block text-sm font-medium">Key</label>
        <Select
          v-model="form.key"
          :options="keyOptions"
          option-label="label"
          option-value="value"
          editable
          show-clear
          class="w-full"
          placeholder="—"
        />
      </div>

      <div class="space-y-1">
        <label class="block text-sm font-medium">Genre</label>
        <InputText v-model="form.genre" class="w-full" placeholder="Old Time, Irish, …" />
      </div>
    </div>

    <div class="space-y-1">
      <label class="block text-sm font-medium">Alternate keys</label>
      <InputChips v-model="form.alt_keys" class="w-full" separator="," />
    </div>

    <div class="space-y-1">
      <label class="block text-sm font-medium">Also known as</label>
      <InputChips v-model="form.aka" class="w-full" separator="," />
    </div>

    <div class="space-y-1">
      <label class="block text-sm font-medium">Notes</label>
      <Textarea v-model="form.notes" class="w-full" rows="3" auto-resize />
    </div>

    <div v-if="!isAdd" class="space-y-2">
      <label class="block text-sm font-medium">Heard at</label>
      <ul v-if="props.tuneSources && props.tuneSources.length" class="space-y-1">
        <li
          v-for="link in props.tuneSources"
          :key="link.id"
          class="flex items-center gap-2 text-sm"
        >
          <i :class="[SOURCE_KIND_ICON[link.source.kind], 'text-surface-400']" />
          <span class="flex-1 min-w-0 truncate">{{ link.source.name }}</span>
          <Button
            type="button"
            icon="pi pi-times"
            severity="secondary"
            text
            rounded
            size="small"
            aria-label="Unlink source"
            @click="emit('unlink-source', link)"
          />
        </li>
      </ul>
      <SourcePicker
        placeholder="Link a source…"
        :exclude-ids="linkedSourceIds"
        @select="(s: Source) => emit('link-source', s)"
      />
    </div>

    <div v-if="isAdd" class="space-y-2 border-t border-surface-200 dark:border-surface-800 pt-4">
      <div class="flex items-center justify-between">
        <label class="block text-sm font-medium">
          Media <span class="text-surface-400 font-normal">(optional)</span>
        </label>
        <Button
          v-if="mediaRows.length === 0"
          type="button"
          severity="secondary"
          text
          size="small"
          @click="addMediaRow"
        >
          <i class="pi pi-plus mr-2" /> Add link
        </Button>
      </div>
      <ol v-if="mediaRows.length" class="space-y-2">
        <li v-for="(row, idx) in mediaRows" :key="idx" class="flex items-start gap-2">
          <InputText
            :model-value="row.url"
            placeholder="https://…"
            class="flex-1"
            autocapitalize="off"
            autocomplete="off"
            @update:model-value="(v) => onMediaUrlInput(idx, v ?? '')"
          />
          <Select
            v-model="row.kind"
            :options="MEDIA_KIND_OPTIONS"
            option-label="label"
            option-value="value"
            class="!w-44"
          />
          <Button
            type="button"
            icon="pi pi-times"
            severity="secondary"
            text
            rounded
            size="small"
            aria-label="Remove media"
            @click="removeMediaRow(idx)"
          />
        </li>
      </ol>
      <div v-if="mediaRows.length">
        <Button type="button" severity="secondary" text size="small" @click="addMediaRow">
          <i class="pi pi-plus mr-2" /> Add another
        </Button>
      </div>
      <p class="text-xs text-surface-500">
        URLs only here; uploads, section anchors, and clip times are available on the tune detail page.
      </p>
    </div>

    <p v-if="errorMsg" class="text-sm text-red-600 dark:text-red-400">{{ errorMsg }}</p>

    <div class="flex justify-end gap-2 pt-2">
      <Button type="button" severity="secondary" text @click="emit('cancel')">Cancel</Button>
      <Button type="submit" :loading="submitting">
        {{ tune ? 'Save changes' : 'Add tune' }}
      </Button>
    </div>
  </form>
</template>
