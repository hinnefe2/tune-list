import { supabase } from '@/services/supabase'
import type { Database } from '@/types/database'

export type Source = Database['public']['Tables']['sources']['Row']
export type SourceInsert = Database['public']['Tables']['sources']['Insert']
export type SourceUpdate = Database['public']['Tables']['sources']['Update']
export type SourceKind = Database['public']['Enums']['source_kind']

export async function listSources(): Promise<Source[]> {
  const { data, error } = await supabase
    .from('sources')
    .select('*')
    .order('name', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function getSource(id: string): Promise<Source | null> {
  const { data, error } = await supabase
    .from('sources')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function createSource(input: SourceInsert): Promise<Source> {
  const { data, error } = await supabase
    .from('sources')
    .insert(input)
    .select('*')
    .single()
  if (error) throw error
  return data
}

export async function updateSource(id: string, patch: SourceUpdate): Promise<Source> {
  const { data, error } = await supabase
    .from('sources')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw error
  return data
}

export async function deleteSource(id: string): Promise<void> {
  const { error } = await supabase.from('sources').delete().eq('id', id)
  if (error) throw error
}
