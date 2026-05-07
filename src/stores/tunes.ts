import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '@/services/supabase'
import {
  listTunes,
  createTune as svcCreate,
  createTunesBulk as svcCreateBulk,
  updateTune as svcUpdate,
  deleteTune as svcDelete,
  type Tune,
  type TuneInsert,
  type TuneUpdate,
} from '@/services/tunes'
import { useAuthStore } from '@/stores/auth'

export const useTunesStore = defineStore('tunes', () => {
  const tunes = ref<Tune[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const initialized = ref(false)

  let channel: RealtimeChannel | null = null

  const byId = computed(() => {
    const map = new Map<string, Tune>()
    for (const t of tunes.value) map.set(t.id, t)
    return map
  })

  function upsertLocal(t: Tune) {
    const i = tunes.value.findIndex((x) => x.id === t.id)
    if (i === -1) tunes.value.push(t)
    else tunes.value[i] = t
  }

  function removeLocal(id: string) {
    tunes.value = tunes.value.filter((t) => t.id !== id)
  }

  async function fetchAll() {
    loading.value = true
    error.value = null
    try {
      tunes.value = await listTunes()
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
      throw e
    } finally {
      loading.value = false
    }
  }

  function subscribe() {
    if (channel) return
    channel = supabase
      .channel('tunes-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tunes' },
        (payload) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            upsertLocal(payload.new as Tune)
          } else if (payload.eventType === 'DELETE') {
            const id = (payload.old as { id?: string }).id
            if (id) removeLocal(id)
          }
        },
      )
      .subscribe()
  }

  async function init() {
    if (initialized.value) return
    await fetchAll()
    subscribe()
    initialized.value = true
  }

  function getById(id: string): Tune | undefined {
    return byId.value.get(id)
  }

  async function create(input: Omit<TuneInsert, 'user_id'>): Promise<Tune> {
    const auth = useAuthStore()
    if (!auth.user) throw new Error('Not signed in')
    const created = await svcCreate({ ...input, user_id: auth.user.id })
    upsertLocal(created)
    return created
  }

  async function createMany(inputs: Omit<TuneInsert, 'user_id'>[]): Promise<Tune[]> {
    const auth = useAuthStore()
    if (!auth.user) throw new Error('Not signed in')
    const userId = auth.user.id
    const created = await svcCreateBulk(inputs.map((i) => ({ ...i, user_id: userId })))
    for (const t of created) upsertLocal(t)
    return created
  }

  async function update(id: string, patch: TuneUpdate): Promise<Tune> {
    const updated = await svcUpdate(id, patch)
    upsertLocal(updated)
    return updated
  }

  async function remove(id: string): Promise<void> {
    await svcDelete(id)
    removeLocal(id)
  }

  return {
    tunes,
    loading,
    error,
    initialized,
    init,
    fetchAll,
    getById,
    create,
    createMany,
    update,
    remove,
    /** Synchronously push a tune row into the local list. Useful when an
     *  external orchestrator (e.g. createTuneWithAttachments) inserts the
     *  tune itself and we want the UI to reflect it without waiting on the
     *  realtime subscription. Idempotent — re-firing realtime will just
     *  replace in place. */
    upsert: upsertLocal,
  }
})
