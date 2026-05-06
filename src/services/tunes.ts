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
