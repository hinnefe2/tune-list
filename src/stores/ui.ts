import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import type { TuneStatus } from '@/services/tunes'

export type SortField = 'name' | 'created_at' | 'updated_at' | 'status'
export type SortDir = 'asc' | 'desc'

interface TuneFilters {
  search: string
  status: TuneStatus | null
  key: string | null
  genre: string | null
  tuning: string | null
  sortField: SortField
  sortDir: SortDir
}

const STORAGE_KEY = 'tune-list:tune-filters'

const defaults = (): TuneFilters => ({
  search: '',
  status: null,
  key: null,
  genre: null,
  tuning: null,
  sortField: 'name',
  sortDir: 'asc',
})

function load(): TuneFilters {
  if (typeof localStorage === 'undefined') return defaults()
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return defaults()
  try {
    return { ...defaults(), ...JSON.parse(raw) }
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

  return { tuneFilters, resetTuneFilters }
})
