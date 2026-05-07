import { createTune, type Tune, type TuneInsert } from '@/services/tunes'
import { linkTuneSource } from '@/services/tune-sources'
import { createMediaLink, type MediaKind } from '@/services/media'
import { createRecording } from '@/services/recordings'
import { uploadRecording } from '@/services/storage'
import type { Source } from '@/services/sources'
import type { RecorderResult } from '@/composables/useAudioRecorder'

export type SaveFailureKind = 'source' | 'media' | 'recording'

export interface SaveFailure {
  kind: SaveFailureKind
  /** Human-friendly identifier for the failed item (source name, media URL). */
  label?: string
  error: Error
}

export interface CreateTuneInput {
  userId: string
  tune: Omit<TuneInsert, 'user_id'>
  sources?: Source[]
  media?: { kind: MediaKind; url: string }[]
  /** Capture-flow audio. Uploaded to storage and linked to the new tune.
   *  When sources are also provided, the recording is associated with the
   *  first source (Capture only ever sets one). */
  recording?: RecorderResult
}

export interface CreateTuneResult {
  tune: Tune
  succeeded: {
    sources: number
    media: number
    recording: boolean
  }
  failures: SaveFailure[]
}

/**
 * Insert a tune and best-effort attach sources / media links / recording.
 *
 * The tune insert is awaited first because every attachment needs the new id.
 * Attachments run in parallel; per-attachment failures collect into the
 * returned failures array rather than aborting the rest. The tune itself is
 * never rolled back on partial failure — callers display a warn and let the
 * user retry from the detail page.
 */
export async function createTuneWithAttachments(
  input: CreateTuneInput,
): Promise<CreateTuneResult> {
  const { userId, tune: tuneInput, sources = [], media = [], recording } = input

  const created = await createTune({ ...tuneInput, user_id: userId })

  const succeeded = { sources: 0, media: 0, recording: false }
  const failures: SaveFailure[] = []
  const asError = (e: unknown): Error => (e instanceof Error ? e : new Error(String(e)))

  const tasks: Promise<void>[] = []

  for (const s of sources) {
    tasks.push(
      linkTuneSource({
        user_id: userId,
        tune_id: created.id,
        source_id: s.id,
        heard_on: null,
        notes: null,
      })
        .then(() => {
          succeeded.sources++
        })
        .catch((e) => {
          failures.push({ kind: 'source', label: s.name, error: asError(e) })
        }),
    )
  }

  for (const m of media) {
    tasks.push(
      createMediaLink({
        user_id: userId,
        tune_id: created.id,
        kind: m.kind,
        url: m.url,
        storage_path: null,
      })
        .then(() => {
          succeeded.media++
        })
        .catch((e) => {
          failures.push({ kind: 'media', label: m.url, error: asError(e) })
        }),
    )
  }

  if (recording) {
    const rec = recording
    tasks.push(
      (async () => {
        const path = await uploadRecording(userId, rec.blob, rec.ext)
        await createRecording({
          user_id: userId,
          tune_id: created.id,
          source_id: sources[0]?.id ?? null,
          storage_path: path,
          duration_seconds: rec.durationSeconds,
        })
        succeeded.recording = true
      })().catch((e) => {
        failures.push({ kind: 'recording', error: asError(e) })
      }),
    )
  }

  await Promise.all(tasks)
  return { tune: created, succeeded, failures }
}
