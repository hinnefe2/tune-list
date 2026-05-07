import Papa from 'papaparse'
import type { Tune } from '@/services/tunes'
import type { MediaLink, MediaKind } from '@/services/media'

const BASE_COLUMNS = ['name', 'key', 'alt_keys', 'aka', 'tuning', 'genre', 'status', 'notes'] as const

// Stable column order for the dynamic media columns. Kinds without any rows
// across the library aren't emitted at all.
const KIND_ORDER: MediaKind[] = ['video', 'audio', 'spotify', 'sheet_music', 'looptube', 'tab', 'other']

export function tunesToCsv(tunes: Tune[], media: MediaLink[] = []): string {
  // Group media by tune, then by kind. Storage-uploaded files have no URL we
  // can put in a CSV cell, so we drop them — those round-trip through the
  // Supabase Storage backup, not this export.
  const byTuneByKind = new Map<string, Map<MediaKind, MediaLink[]>>()
  for (const m of media) {
    if (!m.url) continue
    let tuneMap = byTuneByKind.get(m.tune_id)
    if (!tuneMap) {
      tuneMap = new Map()
      byTuneByKind.set(m.tune_id, tuneMap)
    }
    const list = tuneMap.get(m.kind) ?? []
    list.push(m)
    tuneMap.set(m.kind, list)
  }

  // How many <kind>_N columns we need is the max count of that kind on any one tune.
  const maxByKind = new Map<MediaKind, number>()
  for (const tuneMap of byTuneByKind.values()) {
    for (const [kind, list] of tuneMap.entries()) {
      maxByKind.set(kind, Math.max(maxByKind.get(kind) ?? 0, list.length))
    }
  }

  const mediaColumns: string[] = []
  for (const kind of KIND_ORDER) {
    const max = maxByKind.get(kind) ?? 0
    for (let i = 1; i <= max; i++) mediaColumns.push(`${kind}_${i}`)
  }
  const columns = [...BASE_COLUMNS, ...mediaColumns]

  const rows = tunes.map((t) => {
    const row: Record<string, string> = {
      name: t.name,
      key: t.key ?? '',
      alt_keys: (t.alt_keys ?? []).join('|'),
      aka: (t.aka ?? []).join('|'),
      tuning: t.tuning,
      genre: t.genre ?? '',
      status: t.status,
      notes: t.notes ?? '',
    }
    for (const col of mediaColumns) row[col] = ''
    const tuneMap = byTuneByKind.get(t.id)
    if (tuneMap) {
      for (const kind of KIND_ORDER) {
        const list = tuneMap.get(kind) ?? []
        list.forEach((m, idx) => {
          row[`${kind}_${idx + 1}`] = m.url ?? ''
        })
      }
    }
    return row
  })

  // BOM up front so Excel reliably picks UTF-8.
  return '﻿' + Papa.unparse(rows, { columns })
}

export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  // Defer revoke so the browser has time to start the download.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function isoToday(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
