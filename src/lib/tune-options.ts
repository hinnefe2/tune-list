import type { TuneStatus } from '@/services/tunes'

export const STATUS_OPTIONS: { value: TuneStatus; label: string }[] = [
  { value: 'wishlist', label: 'Wishlist' },
  { value: 'learning', label: 'Learning' },
  { value: 'can_fake', label: 'Can fake' },
  { value: 'can_lead', label: 'Can lead' },
  { value: 'forgotten', label: 'Forgotten' },
]

export const STATUS_LABEL: Record<TuneStatus, string> = Object.fromEntries(
  STATUS_OPTIONS.map((o) => [o.value, o.label]),
) as Record<TuneStatus, string>

// Tailwind classes per status; works in both light and dark.
export const STATUS_BADGE: Record<TuneStatus, string> = {
  wishlist: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200',
  learning: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
  can_fake: 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200',
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

export const SORT_FIELDS: { value: 'name' | 'status' | 'created_at' | 'updated_at'; label: string }[] = [
  { value: 'name', label: 'Name' },
  { value: 'status', label: 'Status' },
  { value: 'created_at', label: 'Date added' },
  { value: 'updated_at', label: 'Last updated' },
]
