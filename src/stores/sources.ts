import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
  listSources,
  createSource as svcCreate,
  updateSource as svcUpdate,
  deleteSource as svcDelete,
  type Source,
  type SourceInsert,
  type SourceUpdate,
} from '@/services/sources'
import { useAuthStore } from '@/stores/auth'

export const useSourcesStore = defineStore('sources', () => {
  const sources = ref<Source[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const initialized = ref(false)

  const byId = computed(() => {
    const map = new Map<string, Source>()
    for (const s of sources.value) map.set(s.id, s)
    return map
  })

  function upsertLocal(s: Source) {
    const i = sources.value.findIndex((x) => x.id === s.id)
    if (i === -1) sources.value.push(s)
    else sources.value[i] = s
    sources.value.sort((a, b) => a.name.localeCompare(b.name))
  }

  function removeLocal(id: string) {
    sources.value = sources.value.filter((s) => s.id !== id)
  }

  async function fetchAll() {
    loading.value = true
    error.value = null
    try {
      sources.value = await listSources()
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
      throw e
    } finally {
      loading.value = false
    }
  }

  async function init() {
    if (initialized.value) return
    await fetchAll()
    initialized.value = true
  }

  function getById(id: string): Source | undefined {
    return byId.value.get(id)
  }

  async function create(input: Omit<SourceInsert, 'user_id'>): Promise<Source> {
    const auth = useAuthStore()
    if (!auth.user) throw new Error('Not signed in')
    const created = await svcCreate({ ...input, user_id: auth.user.id })
    upsertLocal(created)
    return created
  }

  async function update(id: string, patch: SourceUpdate): Promise<Source> {
    const updated = await svcUpdate(id, patch)
    upsertLocal(updated)
    return updated
  }

  async function remove(id: string): Promise<void> {
    await svcDelete(id)
    removeLocal(id)
  }

  return { sources, loading, error, initialized, init, fetchAll, getById, create, update, remove }
})
