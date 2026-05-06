<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import Button from 'primevue/button'
import type { Tune } from '@/services/tunes'
import type { CardWithState } from '@/services/cards'
import type { MediaLink } from '@/services/media'
import type { TuneSourceWithSource } from '@/services/tune-sources'
import type { Rating } from '@/composables/useSpacedRepetition'
import { CARD_KIND_BY_VALUE } from '@/lib/card-options'
import MediaEmbed from '@/components/MediaEmbed.vue'

const props = defineProps<{
  card: CardWithState
  tune: Tune
  media: MediaLink[]
  sources: TuneSourceWithSource[]
}>()

const emit = defineEmits<{ rate: [rating: Rating] }>()

const revealed = ref(false)

watch(
  () => props.card.id,
  () => {
    revealed.value = false
  },
)

const meta = computed(() => CARD_KIND_BY_VALUE[props.card.kind])

// Audio prompts: prefer audio kind, fall back to video.
const audioPrompt = computed<MediaLink | null>(() => {
  if (props.card.kind !== 'name_from_audio') return null
  return (
    props.media.find((m) => m.kind === 'audio' && (m.url || m.storage_path)) ??
    props.media.find((m) => m.kind === 'video' && m.url) ??
    null
  )
})

const sheetReferences = computed<MediaLink[]>(() =>
  ['a_part', 'b_part', 'c_part'].includes(props.card.kind)
    ? props.media.filter((m) => m.kind === 'sheet_music' || m.kind === 'video' || m.kind === 'audio')
    : [],
)

const showTuneName = computed(() => props.card.kind !== 'name_from_audio' || revealed.value)

function reveal() {
  revealed.value = true
}

function rate(r: Rating) {
  if (!revealed.value) return
  emit('rate', r)
}

function onKey(e: KeyboardEvent) {
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
  if (!revealed.value && (e.key === ' ' || e.key === 'Enter')) {
    e.preventDefault()
    reveal()
    return
  }
  if (revealed.value && ['1', '2', '3', '4'].includes(e.key)) {
    e.preventDefault()
    rate(Number(e.key) as Rating)
  }
}

onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))

const ratingButtons: { rating: Rating; label: string; cls: string; key: string }[] = [
  { rating: 1, label: 'Again', cls: 'bg-rose-600 hover:bg-rose-700 text-white', key: '1' },
  { rating: 2, label: 'Hard', cls: 'bg-amber-500 hover:bg-amber-600 text-white', key: '2' },
  { rating: 3, label: 'Good', cls: 'bg-emerald-600 hover:bg-emerald-700 text-white', key: '3' },
  { rating: 4, label: 'Easy', cls: 'bg-sky-600 hover:bg-sky-700 text-white', key: '4' },
]
</script>

<template>
  <div class="space-y-6">
    <div class="text-xs uppercase tracking-wider text-surface-500">{{ meta.label }}</div>

    <div class="space-y-3">
      <h2 class="text-2xl font-semibold tracking-tight">
        <span v-if="showTuneName">{{ meta.prompt(tune.name) }}</span>
        <span v-else>{{ meta.prompt('this tune') }}</span>
      </h2>

      <div v-if="card.kind !== 'name_from_audio'" class="text-sm text-surface-500">
        <template v-if="tune.tuning && tune.tuning !== 'GDAE'">{{ tune.tuning }} · </template>
        <template v-if="tune.genre">{{ tune.genre }}</template>
      </div>

      <div v-if="audioPrompt" class="pt-2">
        <MediaEmbed :media="audioPrompt" />
      </div>
    </div>

    <div v-if="!revealed" class="pt-4">
      <Button @click="reveal">Reveal <span class="ml-2 text-xs opacity-70">space</span></Button>
    </div>

    <div v-else class="space-y-4 border-t border-surface-200 dark:border-surface-800 pt-4">
      <div v-if="card.kind === 'name_from_audio'" class="text-xl font-semibold">{{ tune.name }}</div>

      <div v-if="card.kind === 'key'" class="text-xl font-semibold">
        {{ tune.key ?? '—' }}
        <span v-if="tune.alt_keys.length" class="text-base text-surface-500 font-normal ml-2">
          (also {{ tune.alt_keys.join(', ') }})
        </span>
      </div>

      <div v-if="card.kind === 'source'" class="space-y-1 text-sm">
        <div v-if="!sources.length" class="text-surface-500">No sources linked.</div>
        <ul v-else>
          <li v-for="s in sources" :key="s.id">{{ s.source.name }}</li>
        </ul>
      </div>

      <div v-if="['a_part', 'b_part', 'c_part'].includes(card.kind)" class="space-y-3">
        <div v-if="!sheetReferences.length" class="text-sm text-surface-500">
          No reference media for this tune.
        </div>
        <div v-for="m in sheetReferences" :key="m.id">
          <MediaEmbed :media="m" />
        </div>
      </div>

      <div v-if="card.kind === 'other'" class="text-sm whitespace-pre-wrap">
        {{ card.notes ?? tune.notes ?? 'No notes.' }}
      </div>

      <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2">
        <button
          v-for="b in ratingButtons"
          :key="b.rating"
          type="button"
          :class="['rounded-md px-4 py-3 font-medium text-sm flex flex-col items-center gap-0.5', b.cls]"
          @click="rate(b.rating)"
        >
          <span>{{ b.label }}</span>
          <span class="text-[10px] opacity-80">{{ b.key }}</span>
        </button>
      </div>
    </div>
  </div>
</template>
