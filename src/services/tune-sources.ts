import { supabase } from '@/services/supabase'
import type { Database } from '@/types/database'
import type { Source } from '@/services/sources'

export type TuneSource = Database['public']['Tables']['tune_sources']['Row']
export type TuneSourceInsert = Database['public']['Tables']['tune_sources']['Insert']

export interface TuneSourceWithSource extends TuneSource {
  source: Source
}

export async function listTuneSources(tuneId: string): Promise<TuneSourceWithSource[]> {
  const { data, error } = await supabase
    .from('tune_sources')
    .select('*, source:sources(*)')
    .eq('tune_id', tuneId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as unknown as TuneSourceWithSource[]
}

export async function listTunesForSource(sourceId: string): Promise<{ tune_id: string }[]> {
  const { data, error } = await supabase
    .from('tune_sources')
    .select('tune_id')
    .eq('source_id', sourceId)
  if (error) throw error
  return data ?? []
}

export async function linkTuneSource(
  input: Omit<TuneSourceInsert, 'user_id'> & { user_id: string },
): Promise<TuneSourceWithSource> {
  const { data, error } = await supabase
    .from('tune_sources')
    .insert(input)
    .select('*, source:sources(*)')
    .single()
  if (error) throw error
  return data as unknown as TuneSourceWithSource
}

/**
 * Convenience wrapper for the by-far-most-common shape: link a tune to a
 * source with no `heard_on` date and no notes. Replaces the inline payload
 * boilerplate at every call site.
 */
export async function linkSourceToTune(
  userId: string,
  tuneId: string,
  sourceId: string,
): Promise<TuneSourceWithSource> {
  return linkTuneSource({
    user_id: userId,
    tune_id: tuneId,
    source_id: sourceId,
    heard_on: null,
    notes: null,
  })
}

export async function unlinkTuneSource(id: string): Promise<void> {
  const { error } = await supabase.from('tune_sources').delete().eq('id', id)
  if (error) throw error
}
