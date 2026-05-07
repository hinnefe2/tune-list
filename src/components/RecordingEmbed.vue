<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import type { Recording } from '@/services/recordings'
import { signedRecordingUrl } from '@/services/storage'

const props = defineProps<{ recording: Recording }>()

const signedUrl = ref<string | null>(null)
const errorMsg = ref<string | null>(null)

async function refresh() {
  errorMsg.value = null
  try {
    signedUrl.value = await signedRecordingUrl(props.recording.storage_path)
  } catch (e) {
    errorMsg.value = e instanceof Error ? e.message : String(e)
  }
}

onMounted(refresh)
watch(() => props.recording.storage_path, refresh)

function formatDuration(s: number | null): string {
  if (s === null || s === undefined) return ''
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m}:${sec.toString().padStart(2, '0')}`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}
</script>

<template>
  <div class="space-y-2">
    <div class="flex items-center gap-3 text-xs text-surface-500">
      <span>{{ formatDate(recording.recorded_at) }}</span>
      <span v-if="recording.duration_seconds" class="font-mono tabular-nums">
        {{ formatDuration(recording.duration_seconds) }}
      </span>
    </div>
    <audio v-if="signedUrl" :src="signedUrl" controls preload="metadata" class="w-full" />
    <p v-else-if="errorMsg" class="text-sm text-red-600 dark:text-red-400">
      Couldn't load: {{ errorMsg }}
    </p>
    <p v-else class="text-sm text-surface-500">
      <i class="pi pi-spin pi-spinner mr-2" /> Loading…
    </p>
    <p v-if="recording.notes" class="text-sm text-surface-500 whitespace-pre-wrap">
      {{ recording.notes }}
    </p>
  </div>
</template>
