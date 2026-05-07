import { supabase } from '@/services/supabase'
import type { Database } from '@/types/database'

export type MediaLink = Database['public']['Tables']['media_links']['Row']
export type MediaLinkInsert = Database['public']['Tables']['media_links']['Insert']
export type MediaLinkUpdate = Database['public']['Tables']['media_links']['Update']
export type MediaKind = Database['public']['Enums']['media_kind']

export async function listMediaForTune(tuneId: string): Promise<MediaLink[]> {
  const { data, error } = await supabase
    .from('media_links')
    .select('*')
    .eq('tune_id', tuneId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function listAllMedia(): Promise<MediaLink[]> {
  const { data, error } = await supabase
    .from('media_links')
    .select('*')
    .order('created_at', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function createMediaLink(input: MediaLinkInsert): Promise<MediaLink> {
  const { data, error } = await supabase
    .from('media_links')
    .insert(input)
    .select('*')
    .single()
  if (error) throw error
  return data
}

export async function updateMediaLink(id: string, patch: MediaLinkUpdate): Promise<MediaLink> {
  const { data, error } = await supabase
    .from('media_links')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw error
  return data
}

export async function deleteMediaLink(id: string): Promise<void> {
  const { error } = await supabase.from('media_links').delete().eq('id', id)
  if (error) throw error
}
