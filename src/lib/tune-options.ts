import type { TuneStatus } from '@/services/tunes'

export const STATUS_OPTIONS: { value: TuneStatus; label: string }[] = [
  { value: 'wishlist', label: 'Wishlist' },
  { value: 'learning', label: 'Learning' },
  { value: 'can_follow', label: 'Can follow' },
  { value: 'can_lead', label: 'Can lead' },
  { value: 'forgotten', label: 'Forgotten' },
]

export const STATUS_LABEL: Record<TuneStatus, string> = Object.fromEntries(
  STATUS_OPTIONS.map((o) => [o.value, o.label]),
) as Record<TuneStatus, string>

// Status badge classes; work in both light and dark.
export const STATUS_BADGE: Record<TuneStatus, string> = {
  wishlist: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200',
  learning: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
  can_follow: 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200',
  can_lead: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200',
  forgotten: 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200',
}

// Common keys; the Select is editable so non-listed values are fine.
export const COMMON_KEYS = [
  'A',
  'A modal',
  'Am',
  'Bb',
  'C',
  'D',
  'D modal',
  'Dm',
  'E',
  'Em',
  'F',
  'G',
  'G modal',
  'Gm',
] as const

export const COMMON_TUNINGS = [
  'GDAE',
  'AEAE',
  'ADAE',
  'AEAC#',
  'GDGD',
  'DDAD',
] as const

export type SortField = 'name' | 'key' | 'status' | 'tuning' | 'genre' | 'created_at' | 'updated_at'

export const SORT_FIELDS: { value: SortField; label: string }[] = [
  { value: 'name', label: 'Name' },
  { value: 'key', label: 'Key' },
  { value: 'status', label: 'Status' },
  { value: 'tuning', label: 'Tuning' },
  { value: 'genre', label: 'Genre' },
  { value: 'created_at', label: 'Date added' },
  { value: 'updated_at', label: 'Last updated' },
]

export const SORT_FIELD_LABEL: Record<SortField, string> = Object.fromEntries(
  SORT_FIELDS.map((o) => [o.value, o.label]),
) as Record<SortField, string>

// Status sort ordering: by progress, not alphabetical.
export const STATUS_SORT_INDEX: Record<TuneStatus, number> = {
  wishlist: 0,
  learning: 1,
  can_follow: 2,
  can_lead: 3,
  forgotten: 4,
}
