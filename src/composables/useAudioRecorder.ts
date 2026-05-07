import { onBeforeUnmount, ref, type Ref } from 'vue'

export type RecorderState = 'idle' | 'requesting' | 'recording' | 'stopped' | 'denied' | 'unsupported'

export interface RecorderResult {
  blob: Blob
  mimeType: string
  ext: string
  durationSeconds: number
}

export interface UseAudioRecorderOptions {
  /** Soft cap; recorder auto-stops at this many seconds. Default 120. */
  maxSeconds?: number
}

export interface UseAudioRecorder {
  state: Ref<RecorderState>
  elapsedSeconds: Ref<number>
  errorMessage: Ref<string | null>
  result: Ref<RecorderResult | null>
  start: () => Promise<void>
  stop: () => Promise<RecorderResult | null>
  discard: () => void
  cleanup: () => void
}

const PREFERRED_MIMES: { mime: string; ext: string }[] = [
  { mime: 'audio/webm;codecs=opus', ext: 'webm' },
  { mime: 'audio/webm', ext: 'webm' },
  { mime: 'audio/ogg;codecs=opus', ext: 'ogg' },
  { mime: 'audio/mp4', ext: 'mp4' },
  { mime: 'audio/mpeg', ext: 'mp3' },
]

function pickMime(): { mime: string; ext: string } | null {
  if (typeof MediaRecorder === 'undefined') return null
  for (const opt of PREFERRED_MIMES) {
    try {
      if (MediaRecorder.isTypeSupported(opt.mime)) return opt
    } catch {
      // Some browsers throw for unknown types; continue.
    }
  }
  // Last resort: let the browser pick.
  return { mime: '', ext: 'webm' }
}

export function useAudioRecorder(options: UseAudioRecorderOptions = {}): UseAudioRecorder {
  const maxSeconds = options.maxSeconds ?? 120

  const state = ref<RecorderState>('idle')
  const elapsedSeconds = ref(0)
  const errorMessage = ref<string | null>(null)
  const result = ref<RecorderResult | null>(null)

  let recorder: MediaRecorder | null = null
  let stream: MediaStream | null = null
  let chunks: Blob[] = []
  let startedAt = 0
  let tickHandle: ReturnType<typeof setInterval> | null = null
  let stopResolve: ((value: RecorderResult | null) => void) | null = null
  let chosenMime: { mime: string; ext: string } | null = null

  function clearTick() {
    if (tickHandle !== null) {
      clearInterval(tickHandle)
      tickHandle = null
    }
  }

  function releaseStream() {
    if (stream) {
      for (const track of stream.getTracks()) track.stop()
      stream = null
    }
  }

  async function start() {
    errorMessage.value = null
    result.value = null
    elapsedSeconds.value = 0

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      state.value = 'unsupported'
      errorMessage.value = 'Audio recording is not supported in this browser.'
      return
    }
    chosenMime = pickMime()
    if (!chosenMime) {
      state.value = 'unsupported'
      errorMessage.value = 'MediaRecorder is not available in this browser.'
      return
    }

    state.value = 'requesting'
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch (e) {
      state.value = 'denied'
      errorMessage.value =
        e instanceof Error && e.name === 'NotAllowedError'
          ? 'Microphone permission was denied.'
          : e instanceof Error
            ? e.message
            : String(e)
      return
    }

    chunks = []
    try {
      recorder = chosenMime.mime
        ? new MediaRecorder(stream, { mimeType: chosenMime.mime })
        : new MediaRecorder(stream)
    } catch (e) {
      releaseStream()
      state.value = 'unsupported'
      errorMessage.value = e instanceof Error ? e.message : String(e)
      return
    }

    recorder.addEventListener('dataavailable', (event) => {
      if (event.data && event.data.size > 0) chunks.push(event.data)
    })
    recorder.addEventListener('stop', () => {
      clearTick()
      const elapsed = (performance.now() - startedAt) / 1000
      const mime = chosenMime?.mime || recorder?.mimeType || 'audio/webm'
      const ext = chosenMime?.ext || 'webm'
      const blob = new Blob(chunks, { type: mime })
      releaseStream()
      const out: RecorderResult = {
        blob,
        mimeType: mime,
        ext,
        durationSeconds: Math.max(1, Math.round(elapsed)),
      }
      result.value = out
      state.value = 'stopped'
      const resolve = stopResolve
      stopResolve = null
      if (resolve) resolve(out)
    })
    recorder.addEventListener('error', (event) => {
      const err = (event as unknown as { error?: Error }).error
      errorMessage.value = err?.message ?? 'Recorder error'
    })

    startedAt = performance.now()
    recorder.start()
    state.value = 'recording'
    tickHandle = setInterval(() => {
      elapsedSeconds.value = Math.floor((performance.now() - startedAt) / 1000)
      if (elapsedSeconds.value >= maxSeconds) {
        void stop()
      }
    }, 200)
  }

  function stop(): Promise<RecorderResult | null> {
    if (state.value !== 'recording' || !recorder) return Promise.resolve(result.value)
    return new Promise<RecorderResult | null>((resolve) => {
      stopResolve = resolve
      try {
        recorder?.stop()
      } catch {
        clearTick()
        releaseStream()
        state.value = 'idle'
        resolve(null)
      }
    })
  }

  function discard() {
    clearTick()
    if (recorder && recorder.state !== 'inactive') {
      try {
        recorder.stop()
      } catch {
        /* ignore */
      }
    }
    releaseStream()
    chunks = []
    result.value = null
    elapsedSeconds.value = 0
    state.value = 'idle'
  }

  function cleanup() {
    discard()
  }

  onBeforeUnmount(cleanup)

  return {
    state,
    elapsedSeconds,
    errorMessage,
    result,
    start,
    stop,
    discard,
    cleanup,
  }
}
