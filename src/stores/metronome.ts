import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

const BPM_KEY = 'tune-list:metronome-bpm'
const MIN_BPM = 30
const MAX_BPM = 300
const DEFAULT_BPM = 100

// Web Audio scheduler tuning. Run a quick polling loop, schedule any clicks
// that fall within `lookaheadSeconds` of the current AudioContext clock.
// This pattern (Chris Wilson's "metronome" article) is what keeps the click
// accurate even when the JS event loop stutters.
const SCHEDULER_INTERVAL_MS = 25
const SCHEDULE_LOOKAHEAD_S = 0.1
const CLICK_FREQUENCY_HZ = 1000

function clampBpm(n: number): number {
  if (!Number.isFinite(n)) return DEFAULT_BPM
  return Math.max(MIN_BPM, Math.min(MAX_BPM, Math.round(n)))
}

function loadBpm(): number {
  if (typeof localStorage === 'undefined') return DEFAULT_BPM
  const raw = localStorage.getItem(BPM_KEY)
  if (!raw) return DEFAULT_BPM
  const n = Number(raw)
  return Number.isFinite(n) ? clampBpm(n) : DEFAULT_BPM
}

export const useMetronomeStore = defineStore('metronome', () => {
  const bpm = ref(loadBpm())
  const running = ref(false)

  let audioCtx: AudioContext | null = null
  let nextNoteTime = 0
  let intervalId: number | null = null
  // For tap tempo.
  let tapTimes: number[] = []

  function getCtx(): AudioContext {
    if (!audioCtx) {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      audioCtx = new Ctx()
    }
    return audioCtx
  }

  function scheduleClick(time: number) {
    const ctx = getCtx()
    const osc = ctx.createOscillator()
    const env = ctx.createGain()
    osc.frequency.value = CLICK_FREQUENCY_HZ
    osc.type = 'square'
    // Short envelope, peaks at ~0.4 to keep things from being painful.
    env.gain.setValueAtTime(0, time)
    env.gain.linearRampToValueAtTime(0.4, time + 0.001)
    env.gain.exponentialRampToValueAtTime(0.0001, time + 0.05)
    osc.connect(env)
    env.connect(ctx.destination)
    osc.start(time)
    osc.stop(time + 0.06)
  }

  function tick() {
    const ctx = getCtx()
    const secondsPerBeat = 60 / bpm.value
    while (nextNoteTime < ctx.currentTime + SCHEDULE_LOOKAHEAD_S) {
      scheduleClick(nextNoteTime)
      nextNoteTime += secondsPerBeat
    }
  }

  function start() {
    if (running.value) return
    const ctx = getCtx()
    // Resume in case the context started in 'suspended' state due to autoplay
    // policy; this is what "user gesture" gates require.
    if (ctx.state === 'suspended') void ctx.resume()
    nextNoteTime = ctx.currentTime + 0.05
    intervalId = window.setInterval(tick, SCHEDULER_INTERVAL_MS)
    running.value = true
  }

  function stop() {
    if (!running.value) return
    if (intervalId !== null) {
      window.clearInterval(intervalId)
      intervalId = null
    }
    running.value = false
  }

  function toggle() {
    if (running.value) stop()
    else start()
  }

  function setBpm(n: number) {
    bpm.value = clampBpm(n)
    try {
      localStorage.setItem(BPM_KEY, String(bpm.value))
    } catch {
      /* private mode / quota */
    }
  }

  function tap() {
    const now = performance.now()
    // Reset the tap window if there's been a gap longer than ~2 seconds.
    if (tapTimes.length > 0 && now - tapTimes[tapTimes.length - 1] > 2000) {
      tapTimes = []
    }
    tapTimes.push(now)
    // Keep at most the last 6 taps.
    if (tapTimes.length > 6) tapTimes = tapTimes.slice(-6)
    if (tapTimes.length < 2) return
    const intervals: number[] = []
    for (let i = 1; i < tapTimes.length; i++) {
      intervals.push(tapTimes[i] - tapTimes[i - 1])
    }
    const avg = intervals.reduce((a, b) => a + b, 0) / intervals.length
    setBpm(60000 / avg)
  }

  const beatDurationSeconds = computed(() => 60 / bpm.value)

  return {
    bpm,
    running,
    beatDurationSeconds,
    start,
    stop,
    toggle,
    setBpm,
    tap,
    minBpm: MIN_BPM,
    maxBpm: MAX_BPM,
  }
})
