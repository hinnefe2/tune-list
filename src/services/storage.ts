import { supabase } from '@/services/supabase'

const SCORES_BUCKET = 'scores'
const RECORDINGS_BUCKET = 'recordings'

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

/**
 * Upload a captured audio recording to the user's prefix in the `recordings`
 * bucket. `ext` should match the mime type the recorder produced (e.g. `webm`,
 * `mp4`, `ogg`) — we keep mime info out of the schema and recover it from the
 * file extension.
 */
export async function uploadRecording(
  userId: string,
  blob: Blob,
  ext: string,
): Promise<string> {
  const safeExt = ext.replace(/[^a-z0-9]/gi, '').toLowerCase() || 'webm'
  const path = `${userId}/${crypto.randomUUID()}.${safeExt}`
  const { error } = await supabase.storage.from(RECORDINGS_BUCKET).upload(path, blob, {
    cacheControl: '3600',
    upsert: false,
    contentType: blob.type || undefined,
  })
  if (error) throw error
  return path
}

export async function signedRecordingUrl(path: string, expiresIn = 3600): Promise<string> {
  const { data, error } = await supabase.storage
    .from(RECORDINGS_BUCKET)
    .createSignedUrl(path, expiresIn)
  if (error) throw error
  return data.signedUrl
}

export async function deleteRecording(path: string): Promise<void> {
  const { error } = await supabase.storage.from(RECORDINGS_BUCKET).remove([path])
  if (error) throw error
}

export async function downloadRecordingBlob(path: string): Promise<Blob> {
  const { data, error } = await supabase.storage.from(RECORDINGS_BUCKET).download(path)
  if (error) throw error
  if (!data) throw new Error(`Empty download for ${path}`)
  return data
}
