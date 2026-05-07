<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useToast } from 'primevue/usetoast'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Textarea from 'primevue/textarea'
import Select from 'primevue/select'
import { useTunesStore } from '@/stores/tunes'
import { useSourcesStore } from '@/stores/sources'
import { useAuthStore } from '@/stores/auth'
import { linkTuneSource } from '@/services/tune-sources'
import type { Source } from '@/services/sources'
import { COMMON_KEYS } from '@/lib/tune-options'
import { SOURCE_KIND_ICON, SOURCE_KIND_LABEL } from '@/lib/source-options'
import SourcePicker from '@/components/SourcePicker.vue'
import AudioRecorder from '@/components/AudioRecorder.vue'
import type { RecorderResult } from '@/composables/useAudioRecorder'
import { uploadRecording } from '@/services/storage'
import { createRecording } from '@/services/recordings'

const tunesStore = useTunesStore()
const sourcesStore = useSourcesStore()
const auth = useAuthStore()
const router = useRouter()
const toast = useToast()

const LAST_SOURCE_KEY = 'tune-list:capture-last-source'

const name = ref('')
const key = ref<string | null>(null)
const notes = ref('')
const selectedSource = ref<Source | null>(null)
const saving = ref(false)
const nameInput = ref<InstanceType<typeof InputText> | null>(null)
const stagedRecording = ref<RecorderResult | null>(null)

const keyOptions = COMMON_KEYS.map((k) => ({ value: k, label: k }))

onMounted(async () => {
  // Both stores power the source picker and post-save list updates.
  await Promise.all([
    tunesStore.initialized ? Promise.resolve() : tunesStore.init(),
    sourcesStore.initialized ? Promise.resolve() : sourcesStore.init(),
  ])
  // Pre-select the last used source so the next jam tune is one tap away.
  const lastId = localStorage.getItem(LAST_SOURCE_KEY)
  if (lastId) {
    const found = sourcesStore.getById(lastId)
    if (found) selectedSource.value = found
  }
  focusName()
})

watch(selectedSource, (s) => {
  if (s) localStorage.setItem(LAST_SOURCE_KEY, s.id)
})

function focusName() {
  nextTick(() => {
    const el = nameInput.value as unknown as { $el?: HTMLElement } | null
    const input =
      (el?.$el?.querySelector('input') as HTMLInputElement | null) ??
      (el as unknown as HTMLInputElement | null)
    input?.focus()
  })
}

const canSave = computed(() => name.value.trim().length > 0 && !saving.value)

async function handleSave() {
  if (!canSave.value || !auth.user) return
  saving.value = true
  try {
    const created = await tunesStore.create({
      name: name.value.trim(),
      status: 'wishlist',
      key: key.value,
      notes: notes.value.trim() || null,
    })
    if (selectedSource.value) {
      try {
        await linkTuneSource({
          user_id: auth.user.id,
          tune_id: created.id,
          source_id: selectedSource.value.id,
          heard_on: null,
          notes: null,
        })
      } catch (e) {
        toast.add({
          severity: 'warn',
          summary: 'Tune saved; source link failed',
          detail: e instanceof Error ? e.message : String(e),
          life: 5000,
        })
      }
    }
    if (stagedRecording.value) {
      try {
        const rec = stagedRecording.value
        const path = await uploadRecording(auth.user.id, rec.blob, rec.ext)
        await createRecording({
          user_id: auth.user.id,
          tune_id: created.id,
          source_id: selectedSource.value?.id ?? null,
          storage_path: path,
          duration_seconds: rec.durationSeconds,
        })
      } catch (e) {
        toast.add({
          severity: 'warn',
          summary: 'Tune saved; recording upload failed',
          detail: e instanceof Error ? e.message : String(e),
          life: 5000,
        })
      }
    }
    toast.add({
      severity: 'success',
      summary: `"${created.name}" saved`,
      detail: 'Add another?',
      life: 2500,
    })
    // Clear name, key, notes — keep source for the next tune at the same jam.
    name.value = ''
    key.value = null
    notes.value = ''
    stagedRecording.value = null
    focusName()
  } catch (e) {
    toast.add({
      severity: 'error',
      summary: 'Save failed',
      detail: e instanceof Error ? e.message : String(e),
      life: 5000,
    })
  } finally {
    saving.value = false
  }
}

function clearSource() {
  selectedSource.value = null
  localStorage.removeItem(LAST_SOURCE_KEY)
}

function handleSourceSelect(s: Source) {
  selectedSource.value = s
}

function done() {
  router.push({ name: 'tunes' })
}
</script>

<template>
  <div class="mx-auto max-w-lg px-4 py-6 space-y-5">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-semibold">Capture</h1>
      <Button text size="small" @click="done">Done</Button>
    </div>

    <p class="text-sm text-surface-500">
      Quick add for a tune you just heard. Saves as <span class="font-medium">Wishlist</span>;
      polish it later from the tunes list.
    </p>

    <form class="space-y-4" @submit.prevent="handleSave">
      <div class="space-y-1">
        <label class="block text-sm font-medium">Name</label>
        <InputText
          ref="nameInput"
          v-model="name"
          class="w-full !text-lg"
          placeholder="Tune name"
          autocapitalize="words"
          autocomplete="off"
          autocorrect="off"
          spellcheck="false"
          required
        />
      </div>

      <div class="space-y-1">
        <label class="block text-sm font-medium">Heard at</label>
        <div
          v-if="selectedSource"
          class="flex items-center gap-2 px-3 py-2 rounded border border-surface-200 dark:border-surface-800 bg-surface-50 dark:bg-surface-900"
        >
          <i :class="[SOURCE_KIND_ICON[selectedSource.kind], 'text-surface-400']" />
          <span class="flex-1 min-w-0 truncate">{{ selectedSource.name }}</span>
          <span class="text-xs text-surface-500">{{ SOURCE_KIND_LABEL[selectedSource.kind] }}</span>
          <Button
            icon="pi pi-times"
            severity="secondary"
            text
            rounded
            size="small"
            aria-label="Clear source"
            @click="clearSource"
          />
        </div>
        <SourcePicker v-else placeholder="Search or create a source…" @select="handleSourceSelect" />
      </div>

      <div class="space-y-1">
        <label class="block text-sm font-medium">Recording</label>
        <AudioRecorder v-model:result="stagedRecording" />
      </div>

      <div class="space-y-1">
        <label class="block text-sm font-medium">Key</label>
        <Select
          v-model="key"
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
        <label class="block text-sm font-medium">Notes</label>
        <Textarea v-model="notes" class="w-full" rows="2" auto-resize placeholder="Optional" />
      </div>

      <div class="pt-2">
        <Button
          type="submit"
          class="w-full !py-3 !text-base"
          :loading="saving"
          :disabled="!canSave"
        >
          Save
        </Button>
      </div>
    </form>
  </div>
</template>
