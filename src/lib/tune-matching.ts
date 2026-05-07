import type { Tune } from '@/services/tunes'

export interface TuneMatch {
  tune: Tune
  similarity: number
  matchedField: 'name' | 'aka'
  matchedValue: string
}

/**
 * Aggressive normalization so cosmetic differences don't tank the score:
 * lowercase, drop diacritics, drop punctuation, drop English articles,
 * collapse whitespace.
 */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\b(?:the|a|an)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (a.length === 0) return b.length
  if (b.length === 0) return a.length
  let prev = new Array(b.length + 1)
  for (let j = 0; j <= b.length; j++) prev[j] = j
  let curr = new Array(b.length + 1)
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i
    for (let j = 1; j <= b.length; j++) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost)
    }
    ;[prev, curr] = [curr, prev]
  }
  return prev[b.length]
}

function similarity(a: string, b: string): number {
  const m = Math.max(a.length, b.length)
  if (m === 0) return 1
  return 1 - levenshtein(a, b) / m
}

export interface FindCandidatesOptions {
  /** Tune to skip (e.g. when comparing against the tune being edited). */
  excludeId?: string
  /** 0..1; default 0.8 catches typos and spelling variants without
   *  conflating clearly distinct tunes. */
  threshold?: number
  /** Cap on returned matches. Default 3 — enough to flag, few enough to fit
   *  inline under a form field. */
  limit?: number
}

export function findCandidates(
  query: string,
  tunes: readonly Tune[],
  options: FindCandidatesOptions = {},
): TuneMatch[] {
  const { excludeId, threshold = 0.8, limit = 3 } = options
  const q = normalize(query)
  if (q.length < 2) return []

  const matches: TuneMatch[] = []
  for (const t of tunes) {
    if (t.id === excludeId) continue
    const nameSim = similarity(q, normalize(t.name))
    if (nameSim >= threshold) {
      matches.push({ tune: t, similarity: nameSim, matchedField: 'name', matchedValue: t.name })
      continue
    }
    let bestAka: { value: string; sim: number } | null = null
    for (const aka of t.aka) {
      const s = similarity(q, normalize(aka))
      if (s >= threshold && (!bestAka || s > bestAka.sim)) {
        bestAka = { value: aka, sim: s }
      }
    }
    if (bestAka) {
      matches.push({
        tune: t,
        similarity: bestAka.sim,
        matchedField: 'aka',
        matchedValue: bestAka.value,
      })
    }
  }
  matches.sort((a, b) => b.similarity - a.similarity)
  return matches.slice(0, limit)
}
