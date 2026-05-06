/**
 * SM-2 (lite) — Anki-flavored. Rating scale 1=Again, 2=Hard, 3=Good, 4=Easy.
 * Keeps state minimal: an ease factor and an interval in days. The next
 * review date is derived from today + interval.
 *
 * Stays under ~20 lines on purpose. Don't reach for a real SRS library
 * unless we outgrow it.
 */

export type Rating = 1 | 2 | 3 | 4

export interface SrsState {
  ease: number
  interval: number
}

export interface SrsStep extends SrsState {
  /** YYYY-MM-DD in local time */
  nextReviewOn: string
}

const MIN_EASE = 1.3
const DEFAULT_EASE = 2.5

function clampEase(e: number) {
  return Math.max(MIN_EASE, e)
}

function isoDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function applyRating(prior: SrsState | null, rating: Rating, today = new Date()): SrsStep {
  const p = prior ?? { ease: DEFAULT_EASE, interval: 0 }
  let ease = p.ease
  let interval: number
  switch (rating) {
    case 1: // Again
      interval = 1
      ease = clampEase(ease - 0.2)
      break
    case 2: // Hard
      interval = Math.max(1, Math.round(p.interval * 1.2))
      ease = clampEase(ease - 0.15)
      break
    case 3: // Good
      if (p.interval === 0) interval = 1
      else if (p.interval === 1) interval = 6
      else interval = Math.round(p.interval * ease)
      break
    case 4: // Easy
      interval = Math.round(Math.max(1, p.interval) * ease * 1.3)
      ease = ease + 0.15
      break
  }
  const next = new Date(today)
  next.setDate(next.getDate() + interval)
  return { ease, interval, nextReviewOn: isoDate(next) }
}
