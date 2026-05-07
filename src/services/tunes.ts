import { supabase } from '@/services/supabase'
import type { Database } from '@/types/database'

export type Tune = Database['public']['Tables']['tunes']['Row']
export type TuneInsert = Database['public']['Tables']['tunes']['Insert']
export type TuneUpdate = Database['public']['Tables']['tunes']['Update']
export type TuneStatus = Database['public']['Enums']['tune_status']

export async function listTunes(): Promise<Tune[]> {
  const { data, error } = await supabase
    .from('tunes')
    .select('*')
    .order('name', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function getTune(id: string): Promise<Tune | null> {
  const { data, error } = await supabase
    .from('tunes')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function createTune(input: TuneInsert): Promise<Tune> {
  const { data, error } = await supabase
    .from('tunes')
    .insert(input)
    .select('*')
    .single()
  if (error) throw error
  return data
}

export async function createTunesBulk(inputs: TuneInsert[]): Promise<Tune[]> {
  if (inputs.length === 0) return []
  const { data, error } = await supabase.from('tunes').insert(inputs).select('*')
  if (error) throw error
  return data ?? []
}

export async function updateTune(id: string, patch: TuneUpdate): Promise<Tune> {
  const { data, error } = await supabase
    .from('tunes')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw error
  return data
}

export async function deleteTune(id: string): Promise<void> {
  const { error } = await supabase.from('tunes').delete().eq('id', id)
  if (error) throw error
}

/**
 * Set explicit priorities for a list of tunes. The Learn view passes the
 * full ordered visible list; we walk it with priority = index + 1 so the
 * user's drag/drop translates directly into a stable sort key.
 *
 * Issued as N parallel requests rather than a single statement because
 * PostgREST can't update multiple rows with different values in one call.
 * For the active wishlist (typically dozens, occasionally a few hundred)
 * this is fine.
 */
export async function setTunePriorities(updates: { id: string; priority: number }[]): Promise<void> {
  if (updates.length === 0) return
  // The supabase-js client resolves on HTTP errors and surfaces them via
  // `result.error`, so we collect each call's resolved error rather than
  // relying on Promise rejection.
  const results = await Promise.all(
    updates.map(({ id, priority }) =>
      supabase
        .from('tunes')
        .update({ priority })
        .eq('id', id)
        .then((r) => ({ id, error: r.error })),
    ),
  )
  const failures = results.filter((r) => r.error !== null)
  if (failures.length) {
    const first = failures[0].error
    throw new Error(
      `Priority update failed for ${failures.length}/${updates.length} tune(s): ${first?.message ?? String(first)}`,
    )
  }
}
