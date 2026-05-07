<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { useToast } from 'primevue/usetoast'
import Button from 'primevue/button'
import { useTunesStore } from '@/stores/tunes'
import { useAuthStore } from '@/stores/auth'
import { listDueCards, type CardWithState } from '@/services/cards'
import { recordReview } from '@/services/reviews'
import { supabase } from '@/services/supabase'
import type { Tune } from '@/services/tunes'
import type { MediaLink } from '@/services/media'
import type { Rating } from '@/composables/useSpacedRepetition'
import ReviewCard from '@/components/ReviewCard.vue'
import Metronome from '@/components/Metronome.vue'

const tunesStore = useTunesStore()
const auth = useAuthStore()
const toast = useToast()

const dueCards = ref<CardWithState[]>([])
const loading = ref(true)
const submitting = ref(false)
const currentIndex = ref(0)
const completedCount = ref(0)

// Pre-fetched per-tune supporting data, keyed by tune_id.
const mediaByTune = ref<Map<string, MediaLink[]>>(new Map())

async function loadQueue() {
  loading.value = true
  try {
    if (!tunesStore.initialized) await tunesStore.init()
    dueCards.value = await listDueCards()
    if (dueCards.value.length === 0) return
    const tuneIds = Array.from(new Set(dueCards.value.map((c) => c.tune_id)))
    const { data: mediaRows, error: mediaErr } = await supabase
      .from('media_links')
      .select('*')
      .in('tune_id', tuneIds)
    if (mediaErr) throw mediaErr
    const mediaMap = new Map<string, MediaLink[]>()
    for (const row of mediaRows ?? []) {
      const arr = mediaMap.get(row.tune_id) ?? []
      arr.push(row as MediaLink)
      mediaMap.set(row.tune_id, arr)
    }
    mediaByTune.value = mediaMap
  } catch (e) {
    toast.add({
      severity: 'error',
      summary: 'Failed to load practice queue',
      detail: e instanceof Error ? e.message : String(e),
      life: 6000,
    })
  } finally {
    loading.value = false
  }
}

onMounted(loadQueue)

const currentCard = computed<CardWithState | null>(() => dueCards.value[currentIndex.value] ?? null)

const currentTune = computed<Tune | null>(() => {
  if (!currentCard.value) return null
  return tunesStore.getById(currentCard.value.tune_id) ?? null
})

const currentMedia = computed<MediaLink[]>(() => {
  if (!currentCard.value) return []
  return mediaByTune.value.get(currentCard.value.tune_id) ?? []
})

const isComplete = computed(() => !loading.value && dueCards.value.length > 0 && currentIndex.value >= dueCards.value.length)

async function handleRate(rating: Rating) {
  if (!currentCard.value || !auth.user || submitting.value) return
  submitting.value = true
  try {
    await recordReview(auth.user.id, currentCard.value.id, rating)
    completedCount.value++
    currentIndex.value++
  } catch (e) {
    toast.add({
      severity: 'error',
      summary: 'Failed to record review',
      detail: e instanceof Error ? e.message : String(e),
      life: 5000,
    })
  } finally {
    submitting.value = false
  }
}

async function refresh() {
  currentIndex.value = 0
  completedCount.value = 0
  await loadQueue()
}

function skipCurrent() {
  currentIndex.value++
}
</script>

<template>
  <div class="mx-auto max-w-2xl px-4 py-6 space-y-6">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-semibold">Practice</h1>
      <p class="text-sm text-surface-500">
        Practice and remember tunes you already know here.
      </p>
      <div v-if="dueCards.length && !isComplete" class="text-sm text-surface-500 tabular-nums">
        {{ currentIndex + 1 }} / {{ dueCards.length }}
      </div>
    </div>

    <Metronome />

    <div v-if="loading" class="py-16 text-center text-surface-500">
      <i class="pi pi-spin pi-spinner mr-2" /> Loading…
    </div>

    <div v-else-if="!dueCards.length" class="py-16 text-center space-y-3">
      <p class="text-surface-500">No cards due today.</p>
      <p class="text-xs text-surface-400">
        Mark a tune as <span class="font-medium">Learning</span> to start building your practice queue.
      </p>
      <RouterLink :to="{ name: 'tunes' }">
        <Button text>Go to tunes</Button>
      </RouterLink>
    </div>

    <div v-else-if="isComplete" class="py-16 text-center space-y-3">
      <p class="text-xl font-semibold">Done.</p>
      <p class="text-sm text-surface-500">
        {{ completedCount }} card{{ completedCount === 1 ? '' : 's' }} reviewed today.
      </p>
      <Button @click="refresh">Check for more</Button>
    </div>

    <div v-else-if="currentCard && currentTune" class="rounded-lg border border-surface-200 dark:border-surface-800 p-6">
      <ReviewCard
        :card="currentCard"
        :tune="currentTune"
        :media="currentMedia"
        @rate="handleRate"
      />
    </div>

    <div v-else-if="currentCard && !currentTune" class="py-12 text-center text-surface-500">
      <p>The tune for this card is no longer available.</p>
      <Button text class="mt-3" @click="skipCurrent">Skip</Button>
    </div>
  </div>
</template>
