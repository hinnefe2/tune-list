import { supabase } from '@/services/supabase'
import type { Database } from '@/types/database'

export type Recording = Database['public']['Tables']['recordings']['Row']
export type RecordingInsert = Database['public']['Tables']['recordings']['Insert']

export async function listRecordingsForTune(tuneId: string): Promise<Recording[]> {
  const { data, error } = await supabase
    .from('recordings')
    .select('*')
    .eq('tune_id', tuneId)
    .order('recorded_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function createRecording(input: RecordingInsert): Promise<Recording> {
  const { data, error } = await supabase
    .from('recordings')
    .insert(input)
    .select('*')
    .single()
  if (error) throw error
  return data
}

export async function deleteRecordingRow(id: string): Promise<void> {
  const { error } = await supabase.from('recordings').delete().eq('id', id)
  if (error) throw error
}
