import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import type { TuneStatus } from '@/services/tunes'
import type { SortField } from '@/lib/tune-options'

export type SortDir = 'asc' | 'desc'
export interface SortCriterion {
  field: SortField
  dir: SortDir
}

interface TuneFilters {
  search: string
  status: TuneStatus | null
  key: string | null
  genre: string | null
  tuning: string | null
  sortBy: SortCriterion[]
}

const STORAGE_KEY = 'tune-list:tune-filters'

const defaults = (): TuneFilters => ({
  search: '',
  status: null,
  key: null,
  genre: null,
  tuning: null,
  sortBy: [{ field: 'name', dir: 'asc' }],
})

// Migrate from the previous single-criterion shape if it's still in localStorage.
function normalize(parsed: unknown): TuneFilters {
  const base = defaults()
  if (!parsed || typeof parsed !== 'object') return base
  const v = parsed as Record<string, unknown>
  const out: TuneFilters = { ...base }
  if (typeof v.search === 'string') out.search = v.search
  if (typeof v.status === 'string' || v.status === null) out.status = v.status as TuneStatus | null
  if (typeof v.key === 'string' || v.key === null) out.key = v.key as string | null
  if (typeof v.genre === 'string' || v.genre === null) out.genre = v.genre as string | null
  if (typeof v.tuning === 'string' || v.tuning === null) out.tuning = v.tuning as string | null
  if (Array.isArray(v.sortBy) && v.sortBy.length > 0) {
    out.sortBy = (v.sortBy as SortCriterion[]).filter(
      (c) => c && typeof c.field === 'string' && (c.dir === 'asc' || c.dir === 'desc'),
    )
    if (out.sortBy.length === 0) out.sortBy = base.sortBy
  } else if (typeof v.sortField === 'string' && (v.sortDir === 'asc' || v.sortDir === 'desc')) {
    out.sortBy = [{ field: v.sortField as SortField, dir: v.sortDir }]
  }
  return out
}

function load(): TuneFilters {
  if (typeof localStorage === 'undefined') return defaults()
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return defaults()
  try {
    return normalize(JSON.parse(raw))
  } catch {
    return defaults()
  }
}

export const useUiStore = defineStore('ui', () => {
  const tuneFilters = ref<TuneFilters>(load())

  watch(
    tuneFilters,
    (v) => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(v))
      } catch {
        /* private mode / quota */
      }
    },
    { deep: true },
  )

  function resetTuneFilters() {
    tuneFilters.value = defaults()
  }

  function addSort(field: SortField) {
    if (tuneFilters.value.sortBy.some((c) => c.field === field)) return
    tuneFilters.value.sortBy.push({ field, dir: 'asc' })
  }

  function removeSort(idx: number) {
    if (tuneFilters.value.sortBy.length <= 1) return
    tuneFilters.value.sortBy.splice(idx, 1)
  }

  function moveSort(idx: number, delta: -1 | 1) {
    const list = tuneFilters.value.sortBy
    const target = idx + delta
    if (target < 0 || target >= list.length) return
    const [item] = list.splice(idx, 1)
    list.splice(target, 0, item)
  }

  function toggleSortDir(idx: number) {
    const c = tuneFilters.value.sortBy[idx]
    if (!c) return
    c.dir = c.dir === 'asc' ? 'desc' : 'asc'
  }

  function setSortField(idx: number, field: SortField) {
    const list = tuneFilters.value.sortBy
    if (list.some((c, i) => i !== idx && c.field === field)) return
    const c = list[idx]
    if (c) c.field = field
  }

  return {
    tuneFilters,
    resetTuneFilters,
    addSort,
    removeSort,
    moveSort,
    toggleSortDir,
    setSortField,
  }
})
