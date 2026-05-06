<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import type { MediaLink } from '@/services/media'
import { signedScoreUrl } from '@/services/storage'
import { parseYouTube, youTubeEmbedSrc, parseSpotify, spotifyEmbedSrc } from '@/lib/media-helpers'

const props = defineProps<{ media: MediaLink }>()

const signedUrl = ref<string | null>(null)
const signedError = ref<string | null>(null)

async function refreshSigned() {
  if (!props.media.storage_path) {
    signedUrl.value = null
    return
  }
  signedError.value = null
  try {
    signedUrl.value = await signedScoreUrl(props.media.storage_path)
  } catch (e) {
    signedError.value = e instanceof Error ? e.message : String(e)
  }
}

onMounted(refreshSigned)
watch(() => props.media.storage_path, refreshSigned)

const youtube = computed(() => {
  if (props.media.kind !== 'video' || !props.media.url) return null
  const ref = parseYouTube(props.media.url)
  if (!ref) return null
  if (props.media.start_seconds && !ref.start) ref.start = Number(props.media.start_seconds)
  return ref
})

const spotify = computed(() => {
  if (props.media.kind !== 'spotify' || !props.media.url) return null
  return parseSpotify(props.media.url)
})

const IMAGE_EXTENSIONS = /\.(png|jpe?g|gif|webp|avif|svg|bmp|tiff?)(\?|#|$)/i

function looksLikeImage(src: string | null): boolean {
  if (!src) return false
  // Strip query/hash for the regex test; signed URLs from Supabase Storage
  // include query params after the file extension.
  return IMAGE_EXTENSIONS.test(src)
}

const sheetSrc = computed(() => {
  if (props.media.kind !== 'sheet_music') return null
  if (props.media.storage_path) return signedUrl.value
  if (props.media.url) return props.media.url
  return null
})

const sheetIsImage = computed(() => {
  if (!sheetSrc.value) return false
  // For uploaded files, prefer the original path (before signing) since the
  // signed URL has query params that confuse the extension test.
  return looksLikeImage(props.media.storage_path ?? sheetSrc.value)
})

const externalUrl = computed(() => {
  if (props.media.url && !youtube.value && !spotify.value) return props.media.url
  return null
})
</script>

<template>
  <div class="space-y-2">
    <div v-if="media.title || media.section" class="flex items-center gap-2 text-sm">
      <span v-if="media.section" class="px-1.5 py-0.5 rounded bg-surface-100 dark:bg-surface-800 text-xs font-medium">
        {{ media.section }}
      </span>
      <span v-if="media.title" class="font-medium">{{ media.title }}</span>
    </div>

    <div v-if="youtube" class="aspect-video w-full rounded overflow-hidden bg-black">
      <iframe
        :src="youTubeEmbedSrc(youtube)"
        class="w-full h-full"
        frameborder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowfullscreen
        loading="lazy"
      />
    </div>

    <div v-else-if="spotify" class="w-full">
      <iframe
        :src="spotifyEmbedSrc(spotify)"
        class="w-full"
        :style="{ height: spotify.type === 'track' ? '152px' : '352px' }"
        frameborder="0"
        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
        loading="lazy"
      />
    </div>

    <div v-else-if="media.kind === 'sheet_music'">
      <template v-if="sheetSrc">
        <a v-if="sheetIsImage" :href="sheetSrc" target="_blank" rel="noopener noreferrer" class="block">
          <img
            :src="sheetSrc"
            :alt="media.title ?? 'Sheet music'"
            class="max-w-full rounded border border-surface-200 dark:border-surface-800"
            loading="lazy"
          />
        </a>
        <a
          v-else
          :href="sheetSrc"
          target="_blank"
          rel="noopener noreferrer"
          class="inline-flex items-center gap-2 px-3 py-2 text-sm rounded border border-surface-200 dark:border-surface-800 hover:bg-surface-50 dark:hover:bg-surface-900"
        >
          <i class="pi pi-file-pdf" />
          <span>{{ media.title ?? 'Open sheet music' }}</span>
          <i class="pi pi-external-link text-xs opacity-70" />
        </a>
      </template>
      <p v-else-if="signedError" class="text-sm text-red-600 dark:text-red-400">
        Couldn't load: {{ signedError }}
      </p>
      <p v-else class="text-sm text-surface-500"><i class="pi pi-spin pi-spinner mr-2" /> Loading…</p>
    </div>

    <a
      v-else-if="externalUrl"
      :href="externalUrl"
      target="_blank"
      rel="noopener noreferrer"
      class="text-sm text-primary-600 dark:text-primary-400 hover:underline break-all"
    >
      <i class="pi pi-external-link mr-1" />{{ externalUrl }}
    </a>

    <p v-if="media.notes" class="text-sm text-surface-500 whitespace-pre-wrap">{{ media.notes }}</p>
  </div>
</template>
