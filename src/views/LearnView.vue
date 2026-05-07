<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { useToast } from 'primevue/usetoast'
import Button from 'primevue/button'
import Skeleton from 'primevue/skeleton'
import { useTunesStore } from '@/stores/tunes'
import { setTunePriorities, type Tune } from '@/services/tunes'
import { listAllMedia, type MediaLink } from '@/services/media'
import { STATUS_BADGE, STATUS_LABEL } from '@/lib/tune-options'
import MediaEmbed from '@/components/MediaEmbed.vue'
import { useDelayed } from '@/composables/useDelayed'

const tunesStore = useTunesStore()
const toast = useToast()

const loading = ref(true)
const showSkeleton = useDelayed(loading)
const reordering = ref(false)
const expanded = ref<Set<string>>(new Set())

// Local copy of the ordered list so reorder UI is instant; we reconcile to
// the store's reactive truth after each successful save.
const orderedTunes = ref<Tune[]>([])

const mediaByTune = ref<Map<string, MediaLink[]>>(new Map())

function sortForLearn(tunes: Tune[]): Tune[] {
  return [...tunes].sort((a, b) => {
    const ap = a.priority
    const bp = b.priority
    // NULLS LAST: explicit priorities first, ordered ascending.
    if (ap !== null && bp !== null) {
      if (ap !== bp) return ap - bp
    } else if (ap !== null) return -1
    else if (bp !== null) return 1
    return a.name.localeCompare(b.name)
  })
}

function rebuildOrdered() {
  const filtered = tunesStore.tunes.filter(
    (t) => t.status === 'wishlist' || t.status === 'learning',
  )
  orderedTunes.value = sortForLearn(filtered)
}

async function load() {
  loading.value = true
  try {
    if (!tunesStore.initialized) await tunesStore.init()
    rebuildOrdered()
    const allMedia = await listAllMedia()
    const map = new Map<string, MediaLink[]>()
    for (const m of allMedia) {
      const arr = map.get(m.tune_id) ?? []
      arr.push(m)
      map.set(m.tune_id, arr)
    }
    mediaByTune.value = map
  } catch (e) {
    toast.add({
      severity: 'error',
      summary: 'Failed to load Learn queue',
      detail: e instanceof Error ? e.message : String(e),
      life: 5000,
    })
  } finally {
    loading.value = false
  }
}

onMounted(load)

const isEmpty = computed(() => !loading.value && orderedTunes.value.length === 0)

function toggleExpanded(id: string) {
  const next = new Set(expanded.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  expanded.value = next
}

/**
 * Apply a new array order: write `priority = i + 1` for every item.
 * Optimistic — local state updates first, then we save. On failure we
 * rebuild from the store (which still has the prior priorities).
 */
async function applyOrder(next: Tune[]) {
  if (reordering.value) return
  reordering.value = true
  const previous = orderedTunes.value
  orderedTunes.value = next
  try {
    const updates = next.map((t, i) => ({ id: t.id, priority: i + 1 }))
    await setTunePriorities(updates)
    // Mirror new priorities into the store so other views (and a re-mount
    // of this one) see them without a refetch.
    for (const u of updates) {
      const existing = tunesStore.getById(u.id)
      if (existing) {
        const merged: Tune = { ...existing, priority: u.priority }
        // Direct list mutation is fine — the store exposes `tunes` as a ref.
        const idx = tunesStore.tunes.findIndex((t) => t.id === u.id)
        if (idx !== -1) tunesStore.tunes[idx] = merged
      }
    }
  } catch (e) {
    orderedTunes.value = previous
    toast.add({
      severity: 'error',
      summary: 'Reorder failed',
      detail: e instanceof Error ? e.message : String(e),
      life: 5000,
    })
  } finally {
    reordering.value = false
  }
}

function moveUp(idx: number) {
  if (idx <= 0) return
  const next = [...orderedTunes.value]
  ;[next[idx - 1], next[idx]] = [next[idx], next[idx - 1]]
  void applyOrder(next)
}

function moveDown(idx: number) {
  if (idx >= orderedTunes.value.length - 1) return
  const next = [...orderedTunes.value]
  ;[next[idx], next[idx + 1]] = [next[idx + 1], next[idx]]
  void applyOrder(next)
}

function moveToTop(idx: number) {
  if (idx <= 0) return
  const next = [...orderedTunes.value]
  const [item] = next.splice(idx, 1)
  next.unshift(item)
  void applyOrder(next)
}

function moveToBottom(idx: number) {
  if (idx >= orderedTunes.value.length - 1) return
  const next = [...orderedTunes.value]
  const [item] = next.splice(idx, 1)
  next.push(item)
  void applyOrder(next)
}
</script>

<template>
  <div class="mx-auto max-w-3xl px-4 py-6 space-y-5">
    <header class="space-y-1">
      <h1 class="text-2xl font-semibold">Learn</h1>
      <p class="text-sm text-surface-500">
        Tunes in <span class="font-medium">Wishlist</span> and
        <span class="font-medium">Learning</span>, in priority order. Reorder to
        plan what's next; tap a tune to peek at its media without leaving the queue.
      </p>
    </header>

    <div v-if="loading" aria-busy="true" class="space-y-3">
      <div v-if="showSkeleton" class="space-y-3">
        <Skeleton v-for="i in 5" :key="i" height="3rem" />
      </div>
    </div>

    <div v-else-if="isEmpty" class="py-16 text-center space-y-3">
      <p class="text-surface-500">Nothing to learn yet.</p>
      <p class="text-xs text-surface-400">
        Tunes you mark <span class="font-medium">Wishlist</span> or
        <span class="font-medium">Learning</span> will show up here.
      </p>
    </div>

    <ul v-else class="space-y-2">
      <li
        v-for="(tune, idx) in orderedTunes"
        :key="tune.id"
        class="border border-surface-200 dark:border-surface-800 rounded-lg overflow-hidden"
      >
        <div class="flex items-center gap-2 px-3 py-2">
          <span class="text-xs text-surface-400 tabular-nums w-6 text-right shrink-0">
            {{ idx + 1 }}
          </span>
          <button
            type="button"
            class="flex-1 min-w-0 text-left flex items-center gap-2 hover:opacity-80"
            :aria-expanded="expanded.has(tune.id)"
            @click="toggleExpanded(tune.id)"
          >
            <i
              :class="[
                'pi text-xs text-surface-400 transition-transform',
                expanded.has(tune.id) ? 'pi-chevron-down' : 'pi-chevron-right',
              ]"
            />
            <span class="truncate font-medium">{{ tune.name }}</span>
            <span
              :class="[
                'shrink-0 inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium',
                STATUS_BADGE[tune.status],
              ]"
            >
              {{ STATUS_LABEL[tune.status] }}
            </span>
            <span v-if="tune.key" class="shrink-0 text-xs text-surface-500">
              {{ tune.key }}
            </span>
          </button>
          <div class="flex items-center gap-0.5 shrink-0">
            <Button
              icon="pi pi-angle-double-up"
              text
              rounded
              size="small"
              aria-label="Move to top"
              :disabled="idx === 0 || reordering"
              @click="moveToTop(idx)"
            />
            <Button
              icon="pi pi-angle-up"
              text
              rounded
              size="small"
              aria-label="Move up"
              :disabled="idx === 0 || reordering"
              @click="moveUp(idx)"
            />
            <Button
              icon="pi pi-angle-down"
              text
              rounded
              size="small"
              aria-label="Move down"
              :disabled="idx === orderedTunes.length - 1 || reordering"
              @click="moveDown(idx)"
            />
            <Button
              icon="pi pi-angle-double-down"
              text
              rounded
              size="small"
              aria-label="Move to bottom"
              :disabled="idx === orderedTunes.length - 1 || reordering"
              @click="moveToBottom(idx)"
            />
          </div>
        </div>

        <div
          v-if="expanded.has(tune.id)"
          class="border-t border-surface-200 dark:border-surface-800 bg-surface-50 dark:bg-surface-950 px-4 py-3 space-y-3"
        >
          <ul v-if="(mediaByTune.get(tune.id) ?? []).length" class="space-y-4">
            <li v-for="m in mediaByTune.get(tune.id)" :key="m.id">
              <MediaEmbed :media="m" />
            </li>
          </ul>
          <p v-else class="text-sm text-surface-500">No media linked yet.</p>
          <RouterLink
            :to="{ name: 'tune-detail', params: { id: tune.id } }"
            class="text-sm text-primary-600 dark:text-primary-400 hover:underline inline-flex items-center gap-1"
          >
            Open tune detail <i class="pi pi-arrow-right text-xs" />
          </RouterLink>
        </div>
      </li>
    </ul>
  </div>
</template>
