import Papa from 'papaparse'
import type { TuneInsert, TuneStatus } from '@/services/tunes'
import type { MediaKind } from '@/services/media'
import { STATUS_OPTIONS } from '@/lib/tune-options'
import { inferKindFromUrl } from '@/lib/media-helpers'

const VALID_STATUSES = new Set<TuneStatus>(STATUS_OPTIONS.map((o) => o.value))

const FIELD_ALIASES: Record<string, string> = {
  // canonical → canonical
  name: 'name',
  title: 'name',
  tune: 'name',
  key: 'key',
  'key signature': 'key',
  aka: 'aka',
  aliases: 'aka',
  'also known as': 'aka',
  also_known_as: 'aka',
  alt_keys: 'alt_keys',
  'alt keys': 'alt_keys',
  'alternate keys': 'alt_keys',
  'other keys': 'alt_keys',
  tuning: 'tuning',
  genre: 'genre',
  style: 'genre',
  status: 'status',
  level: 'status',
  notes: 'notes',
  comments: 'notes',
  source: 'source',
  sources: 'source',
  'heard at': 'source',
  audio_url: 'audio_url',
  'audio url': 'audio_url',
  'audio link': 'audio_url',
  sheet_url: 'sheet_url',
  'sheet url': 'sheet_url',
  'sheet music link': 'sheet_url',
  'sheet music url': 'sheet_url',
  looptube_url: 'looptube_url',
  'looptube url': 'looptube_url',
  looptube: 'looptube_url',
}

function normalizeHeader(h: string): string {
  // Strip BOM and zero-width characters that sometimes ride along with CSVs
  // exported from Excel/Sheets.
  return h
    .trim()
    .toLowerCase()
    .replace(/[​‌‍﻿]/g, '')
}

function splitArray(raw: string): string[] {
  // Pipe is the convention since CSV cells often contain commas. Fall back
  // to semicolons too — both are common.
  return raw
    .split(/[|;]/)
    .map((s) => s.trim())
    .filter(Boolean)
}

function coerceStatus(raw: string | undefined): { value: TuneStatus; defaulted: boolean } {
  if (!raw) return { value: 'wishlist', defaulted: false }
  const normalized = raw.trim().toLowerCase().replace(/[\s-]/g, '_') as TuneStatus
  if (VALID_STATUSES.has(normalized)) return { value: normalized, defaulted: false }
  return { value: 'wishlist', defaulted: true }
}

export interface ParsedMediaLink {
  kind: MediaKind
  url: string
}

export interface ParsedTune {
  insert: Omit<TuneInsert, 'user_id'>
  sourceNames: string[]
  mediaLinks: ParsedMediaLink[]
  warnings: string[]
}

export interface ParseResult {
  headers: string[]
  recognized: Record<string, string> // raw header → canonical field
  unrecognizedHeaders: string[]
  valid: ParsedTune[]
  skipped: { rowNumber: number; reason: string }[]
  errors: string[]
}

export async function parseTunesCsv(file: File): Promise<ParseResult> {
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: 'greedy',
      transformHeader: normalizeHeader,
      complete: (results) => {
        const headers = (results.meta.fields ?? []).slice()
        const recognized: Record<string, string> = {}
        for (const h of headers) {
          const canonical = FIELD_ALIASES[h]
          if (canonical) recognized[h] = canonical
        }
        const unrecognizedHeaders = headers.filter((h) => !recognized[h])

        const valid: ParsedTune[] = []
        const skipped: { rowNumber: number; reason: string }[] = []

        results.data.forEach((row, i) => {
          const rowNumber = i + 2 // +1 for header, +1 for 1-indexing
          const get = (canonical: string): string | undefined => {
            for (const [raw, can] of Object.entries(recognized)) {
              if (can === canonical) {
                const v = row[raw]
                if (typeof v === 'string') return v
              }
            }
            return undefined
          }

          const name = (get('name') ?? '').trim()
          if (!name) {
            skipped.push({ rowNumber, reason: 'missing name' })
            return
          }

          const warnings: string[] = []
          const status = coerceStatus(get('status'))
          if (status.defaulted && get('status')) {
            warnings.push(`unknown status "${get('status')}" → wishlist`)
          }

          const insert: Omit<TuneInsert, 'user_id'> = {
            name,
            aka: splitArray(get('aka') ?? ''),
            key: (get('key') ?? '').trim() || null,
            alt_keys: splitArray(get('alt_keys') ?? ''),
            tuning: (get('tuning') ?? '').trim() || 'GDAE',
            genre: (get('genre') ?? '').trim() || null,
            status: status.value,
            notes: (get('notes') ?? '').trim() || null,
          }

          const sourceNames = splitArray(get('source') ?? '')

          const mediaLinks: ParsedMediaLink[] = []
          const audioUrl = (get('audio_url') ?? '').trim()
          if (audioUrl) {
            // YouTube/Spotify links inferred; otherwise treat as plain audio.
            const inferred = inferKindFromUrl(audioUrl)
            const kind: MediaKind = inferred === 'other' ? 'audio' : inferred
            mediaLinks.push({ kind, url: audioUrl })
          }
          const sheetUrl = (get('sheet_url') ?? '').trim()
          if (sheetUrl) mediaLinks.push({ kind: 'sheet_music', url: sheetUrl })
          const looptubeUrl = (get('looptube_url') ?? '').trim()
          if (looptubeUrl) mediaLinks.push({ kind: 'looptube', url: looptubeUrl })

          valid.push({ insert, sourceNames, mediaLinks, warnings })
        })

        resolve({
          headers,
          recognized,
          unrecognizedHeaders,
          valid,
          skipped,
          errors: results.errors.map((e) => `Row ${e.row ?? '?'}: ${e.message}`),
        })
      },
      error: (err) => reject(err),
    })
  })
}
