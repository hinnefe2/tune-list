import Papa from 'papaparse'
import type { Tune } from '@/services/tunes'

const COLUMNS = ['name', 'key', 'alt_keys', 'aka', 'tuning', 'genre', 'status', 'notes'] as const

export function tunesToCsv(tunes: Tune[]): string {
  const rows = tunes.map((t) => ({
    name: t.name,
    key: t.key ?? '',
    alt_keys: (t.alt_keys ?? []).join('|'),
    aka: (t.aka ?? []).join('|'),
    tuning: t.tuning,
    genre: t.genre ?? '',
    status: t.status,
    notes: t.notes ?? '',
  }))
  // BOM up front so Excel reliably picks UTF-8.
  return '﻿' + Papa.unparse(rows, { columns: [...COLUMNS] })
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
