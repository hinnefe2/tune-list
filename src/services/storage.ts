import { supabase } from '@/services/supabase'

const SCORES_BUCKET = 'scores'

function sanitizeFilename(name: string): string {
  return name.replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 80)
}

/** Upload a sheet music file to the user's prefix in the `scores` bucket. */
export async function uploadScore(userId: string, file: File): Promise<string> {
  const path = `${userId}/${crypto.randomUUID()}-${sanitizeFilename(file.name)}`
  const { error } = await supabase.storage.from(SCORES_BUCKET).upload(path, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: file.type || undefined,
  })
  if (error) throw error
  return path
}

/** Resolve a storage path to a signed URL valid for `expiresIn` seconds. */
export async function signedScoreUrl(path: string, expiresIn = 3600): Promise<string> {
  const { data, error } = await supabase.storage
    .from(SCORES_BUCKET)
    .createSignedUrl(path, expiresIn)
  if (error) throw error
  return data.signedUrl
}

export async function deleteScore(path: string): Promise<void> {
  const { error } = await supabase.storage.from(SCORES_BUCKET).remove([path])
  if (error) throw error
}
