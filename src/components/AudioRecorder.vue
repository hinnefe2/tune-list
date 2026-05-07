<script setup lang="ts">
import { computed, watch } from 'vue'
import Button from 'primevue/button'
import { useAudioRecorder, type RecorderResult } from '@/composables/useAudioRecorder'

const props = defineProps<{
  result: RecorderResult | null
  maxSeconds?: number
  /** When true, renders compact (no boxed container). */
  compact?: boolean
}>()

const emit = defineEmits<{
  'update:result': [value: RecorderResult | null]
}>()

const effectiveMaxSeconds = computed(() => props.maxSeconds ?? 120)

const { state, elapsedSeconds, errorMessage, result, start, stop, discard } =
  useAudioRecorder({ maxSeconds: effectiveMaxSeconds.value })

// Mirror local state up to the parent without echoing parent-driven resets back.
watch(result, (r) => {
  if (r !== props.result) emit('update:result', r)
})

watch(
  () => props.result,
  (r) => {
    // Parent cleared the staged recording (e.g. after save or cancel).
    // If we have local state — either a captured blob or an in-flight
    // recording — tear it down so the mic stream is released.
    if (r === null && (result.value !== null || state.value === 'recording')) {
      discard()
    }
  },
)

const previewUrl = computed(() =>
  result.value ? URL.createObjectURL(result.value.blob) : null,
)
watch(previewUrl, (_newUrl, oldUrl) => {
  if (oldUrl) URL.revokeObjectURL(oldUrl)
})

function formatTime(s: number): string {
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m}:${sec.toString().padStart(2, '0')}`
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const remainingSeconds = computed(() =>
  Math.max(0, effectiveMaxSeconds.value - elapsedSeconds.value),
)

const maxLabel = computed(() => {
  const m = effectiveMaxSeconds.value
  if (m % 60 === 0) {
    const min = m / 60
    return `${min} min`
  }
  return `${m}s`
})

const fileSizeLabel = computed(() =>
  result.value ? formatBytes(result.value.blob.size) : null,
)

async function handleStart() {
  await start()
}

async function handleStop() {
  await stop()
}

function handleDiscard() {
  discard()
}
</script>

<template>
  <div
    :class="[
      'space-y-2',
      compact
        ? ''
        : 'rounded border border-surface-200 dark:border-surface-800 p-3',
    ]"
  >
    <div class="flex items-center gap-3">
      <Button
        v-if="state === 'idle' || state === 'denied' || state === 'unsupported'"
        type="button"
        severity="secondary"
        :disabled="state === 'unsupported'"
        @click="handleStart"
      >
        <i class="pi pi-microphone mr-2" />
        {{ state === 'denied' ? 'Try again' : 'Record' }}
      </Button>

      <Button
        v-else-if="state === 'requesting'"
        type="button"
        severity="secondary"
        disabled
      >
        <i class="pi pi-spin pi-spinner mr-2" /> Requesting mic…
      </Button>

      <template v-else-if="state === 'recording'">
        <Button type="button" severity="danger" @click="handleStop">
          <i class="pi pi-stop-circle mr-2" /> Stop
        </Button>
        <span class="font-mono text-sm tabular-nums">
          <span class="inline-block w-2 h-2 rounded-full bg-red-500 mr-2 animate-pulse" />
          {{ formatTime(elapsedSeconds) }}
        </span>
        <span class="text-xs text-surface-500">
          {{ remainingSeconds }}s left
        </span>
      </template>

      <template v-else-if="state === 'stopped' && result">
        <Button type="button" severity="secondary" outlined @click="handleDiscard">
          <i class="pi pi-trash mr-2" /> Discard
        </Button>
        <Button type="button" severity="secondary" text @click="handleStart">
          <i class="pi pi-refresh mr-2" /> Re-record
        </Button>
        <span class="font-mono text-sm tabular-nums text-surface-500">
          {{ formatTime(result.durationSeconds) }}
        </span>
        <span v-if="fileSizeLabel" class="text-xs text-surface-500">
          {{ fileSizeLabel }}
        </span>
      </template>
    </div>

    <p
      v-if="state === 'idle'"
      class="text-xs text-surface-500"
    >
      Recordings are capped at {{ maxLabel }}.
    </p>

    <audio
      v-if="state === 'stopped' && previewUrl"
      :src="previewUrl"
      controls
      class="w-full"
    />

    <p
      v-if="state === 'denied'"
      class="text-xs text-surface-500"
    >
      Mic permission was denied. You can still save the tune without a recording, or
      re-enable mic access in your browser settings and try again.
    </p>
    <p
      v-else-if="state === 'unsupported'"
      class="text-xs text-surface-500"
    >
      Audio recording isn't available in this browser.
    </p>
    <p
      v-else-if="errorMessage"
      class="text-xs text-red-600 dark:text-red-400"
    >
      {{ errorMessage }}
    </p>
  </div>
</template>
