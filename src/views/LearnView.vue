<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { useToast } from 'primevue/usetoast'
import Button from 'primevue/button'
import Skeleton from 'primevue/skeleton'
import { useTunesStore } from '@/stores/tunes'
import { setTunePriorities, type Tune, type TuneStatus } from '@/services/tunes'
import { listAllMedia, type MediaLink } from '@/services/media'
import { STATUS_BADGE, STATUS_LABEL, STATUS_OPTIONS } from '@/lib/tune-options'
import MediaEmbed from '@/components/MediaEmbed.vue'
import { useDelayed } from '@/composables/useDelayed'

// Sections run most-learned first, so "up" always means progress. Each keeps
// its own priority sequence (priority = index + 1 within the section).
type SectionStatus = Extract<TuneStatus, 'can_follow' | 'learning' | 'wishlist'>
const SECTION_STATUSES: SectionStatus[] = ['can_follow', 'learning', 'wishlist']

function isSectionStatus(status: TuneStatus): status is SectionStatus {
  return (SECTION_STATUSES as TuneStatus[]).includes(status)
}

const tunesStore = useTunesStore()
const toast = useToast()

const loading = ref(true)
const showSkeleton = useDelayed(loading)
const reordering = ref(false)
const expanded = ref<Set<string>>(new Set())

// Local copy of the ordered lists so reorder UI is instant; we reconcile to
// the store's reactive truth after each successful save.
const sections = ref<Record<SectionStatus, Tune[]>>({
  can_follow: [],
  learning: [],
  wishlist: [],
})

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
  const next: Record<SectionStatus, Tune[]> = {
    can_follow: [],
    learning: [],
    wishlist: [],
  }
  for (const tune of tunesStore.tunes) {
    if (isSectionStatus(tune.status)) next[tune.status].push(tune)
  }
  for (const status of SECTION_STATUSES) {
    next[status] = sortForLearn(next[status])
  }
  sections.value = next
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

const isEmpty = computed(
  () => !loading.value && SECTION_STATUSES.every((s) => sections.value[s].length === 0),
)

function toggleExpanded(id: string) {
  const next = new Set(expanded.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  expanded.value = next
}

/**
 * Write `priority = i + 1` for every item in each supplied section list and
 * mirror the result into the store. Priorities are only ever compared within
 * a section, so the sequences restart at 1 per status.
 */
async function persistPriorities(lists: Tune[][]) {
  const all = lists.flatMap((list) =>
    list.map((t, i) => ({ id: t.id, priority: i + 1 })),
  )
  await setTunePriorities(all)
  // Mirror new priorities into the store so other views (and a re-mount
  // of this one) see them without a refetch.
  for (const u of all) {
    const existing = tunesStore.getById(u.id)
    if (existing) {
      const merged: Tune = { ...existing, priority: u.priority }
      // Direct list mutation is fine — the store exposes `tunes` as a ref.
      const idx = tunesStore.tunes.findIndex((t) => t.id === u.id)
      if (idx !== -1) tunesStore.tunes[idx] = merged
    }
  }
}

/**
 * Apply a new order within one section. Optimistic — local state updates
 * first, then we save. On failure we restore the previous local order (the
 * store still has the prior priorities).
 */
async function applyOrder(status: SectionStatus, next: Tune[]) {
  if (reordering.value) return
  reordering.value = true
  const previous = sections.value[status]
  sections.value[status] = next
  try {
    await persistPriorities([next])
  } catch (e) {
    sections.value[status] = previous
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

function moveUp(status: SectionStatus, idx: number) {
  if (idx <= 0) return
  const next = [...sections.value[status]]
  ;[next[idx - 1], next[idx]] = [next[idx], next[idx - 1]]
  void applyOrder(status, next)
}

function moveDown(status: SectionStatus, idx: number) {
  if (idx >= sections.value[status].length - 1) return
  const next = [...sections.value[status]]
  ;[next[idx], next[idx + 1]] = [next[idx + 1], next[idx]]
  void applyOrder(status, next)
}

function moveToTop(status: SectionStatus, idx: number) {
  if (idx <= 0) return
  const next = [...sections.value[status]]
  const [item] = next.splice(idx, 1)
  next.unshift(item)
  void applyOrder(status, next)
}

function moveToBottom(status: SectionStatus, idx: number) {
  if (idx >= sections.value[status].length - 1) return
  const next = [...sections.value[status]]
  const [item] = next.splice(idx, 1)
  next.push(item)
  void applyOrder(status, next)
}

async function setStatus(tune: Tune, next: TuneStatus) {
  if (tune.status === next) return
  const from = isSectionStatus(tune.status) ? tune.status : null
  try {
    const updated = await tunesStore.update(tune.id, { status: next })
    const lists: Record<SectionStatus, Tune[]> = {
      can_follow: [...sections.value.can_follow],
      learning: [...sections.value.learning],
      wishlist: [...sections.value.wishlist],
    }
    if (from) lists[from] = lists[from].filter((t) => t.id !== tune.id)

    if (isSectionStatus(next)) {
      // Land next to the boundary the tune just crossed: promoting a tune
      // (moving up a section) puts it at the bottom of the destination,
      // demoting it puts it at the top.
      const movedUp =
        from !== null &&
        SECTION_STATUSES.indexOf(next) < SECTION_STATUSES.indexOf(from)
      lists[next] = movedUp ? [...lists[next], updated] : [updated, ...lists[next]]
      sections.value = lists
      // The status itself is already saved; a failure here only means the new
      // placement didn't stick, so it gets its own message.
      try {
        await persistPriorities(from ? [lists[from], lists[next]] : [lists[next]])
      } catch (e) {
        toast.add({
          severity: 'warn',
          summary: 'New position not saved',
          detail: e instanceof Error ? e.message : String(e),
          life: 5000,
        })
      }
    } else {
      // Left the Learn-eligible set entirely — drop the row and collapse it.
      sections.value = lists
      const nextExpanded = new Set(expanded.value)
      nextExpanded.delete(tune.id)
      expanded.value = nextExpanded
    }
    toast.add({
      severity: 'success',
      summary: `Moved to ${STATUS_LABEL[next]}`,
      life: 1800,
    })
  } catch (e) {
    toast.add({
      severity: 'error',
      summary: 'Status change failed',
      detail: e instanceof Error ? e.message : String(e),
      life: 5000,
    })
  }
}
</script>

<template>
  <div class="mx-auto max-w-3xl px-4 py-6 space-y-5">
    <header class="space-y-1">
      <h1 class="text-2xl font-semibold">Learn</h1>
      <p class="text-sm text-surface-500">
        Tunes in <span class="font-medium">Can follow</span>,
        <span class="font-medium">Learning</span> and
        <span class="font-medium">Wishlist</span>, each in priority order. Reorder to
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
        Tunes you mark <span class="font-medium">Can follow</span>,
        <span class="font-medium">Learning</span> or
        <span class="font-medium">Wishlist</span> will show up here.
      </p>
    </div>

    <template v-else>
      <section
        v-for="status in SECTION_STATUSES"
        :key="status"
        class="space-y-2"
      >
        <h2 class="text-sm font-semibold text-surface-500 uppercase tracking-wide">
          {{ STATUS_LABEL[status] }}
          <span class="ml-1 font-normal tabular-nums text-surface-400">
            {{ sections[status].length }}
          </span>
        </h2>

        <p v-if="!sections[status].length" class="text-xs text-surface-400">
          Nothing here yet.
        </p>

        <ul v-else class="space-y-2">
          <li
            v-for="(tune, idx) in sections[status]"
            :key="tune.id"
            class="border border-surface-200 dark:border-surface-800 rounded-lg overflow-hidden"
          >
            <div class="flex items-center gap-2 px-3 py-2 flex-wrap">
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
                <span v-if="tune.key" class="shrink-0 text-xs text-surface-500">
                  {{ tune.key }}
                </span>
              </button>
              <div
                :class="[
                  'flex items-center gap-0.5 shrink-0',
                  expanded.has(tune.id) ? 'max-sm:basis-full max-sm:justify-end' : '',
                ]"
              >
                <Button
                  icon="pi pi-angle-double-up"
                  text
                  rounded
                  size="small"
                  aria-label="Move to top"
                  :disabled="idx === 0 || reordering"
                  @click="moveToTop(status, idx)"
                />
                <Button
                  icon="pi pi-angle-up"
                  text
                  rounded
                  size="small"
                  aria-label="Move up"
                  :disabled="idx === 0 || reordering"
                  @click="moveUp(status, idx)"
                />
                <Button
                  icon="pi pi-angle-down"
                  text
                  rounded
                  size="small"
                  aria-label="Move down"
                  :disabled="idx === sections[status].length - 1 || reordering"
                  @click="moveDown(status, idx)"
                />
                <Button
                  icon="pi pi-angle-double-down"
                  text
                  rounded
                  size="small"
                  aria-label="Move to bottom"
                  :disabled="idx === sections[status].length - 1 || reordering"
                  @click="moveToBottom(status, idx)"
                />
              </div>
            </div>

            <div
              v-if="expanded.has(tune.id)"
              class="bg-surface-50 dark:bg-surface-950 px-4 py-3 space-y-3"
            >
              <div class="flex flex-wrap items-center gap-1.5">
                <button
                  v-for="opt in STATUS_OPTIONS"
                  :key="opt.value"
                  type="button"
                  :aria-pressed="tune.status === opt.value"
                  :class="[
                    'inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium transition',
                    tune.status === opt.value
                      ? STATUS_BADGE[opt.value]
                      : 'bg-transparent text-surface-500 dark:text-surface-400 ring-1 ring-inset ring-surface-300 dark:ring-surface-700 hover:bg-surface-100 dark:hover:bg-surface-900',
                  ]"
                  @click="setStatus(tune, opt.value)"
                >
                  {{ opt.label }}
                </button>
              </div>
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
      </section>
    </template>
  </div>
</template>
