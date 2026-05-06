import type { Database } from '@/types/database'

export type CardKind = Database['public']['Enums']['card_kind']

export interface CardKindMeta {
  value: CardKind
  label: string
  prompt: (tuneName: string) => string
  description: string
  defaultOnLearning: boolean
}

export const CARD_KIND_META: CardKindMeta[] = [
  {
    value: 'a_part',
    label: 'A part',
    prompt: (n) => `Play the A part of "${n}".`,
    description: 'Recall and play the A-part melody.',
    defaultOnLearning: true,
  },
  {
    value: 'b_part',
    label: 'B part',
    prompt: (n) => `Play the B part of "${n}".`,
    description: 'Recall and play the B-part melody.',
    defaultOnLearning: true,
  },
  {
    value: 'c_part',
    label: 'C part',
    prompt: (n) => `Play the C part of "${n}".`,
    description: 'For tunes with a third part.',
    defaultOnLearning: false,
  },
  {
    value: 'key',
    label: 'Key',
    prompt: (n) => `What key is "${n}" in?`,
    description: 'Recall the key.',
    defaultOnLearning: true,
  },
  {
    value: 'name_from_audio',
    label: 'Name from audio',
    prompt: () => 'Listen and name the tune.',
    description: 'Identify the tune from a linked audio clip.',
    defaultOnLearning: false,
  },
  {
    value: 'source',
    label: 'Source',
    prompt: (n) => `Where did you first hear "${n}"?`,
    description: 'Recall the source.',
    defaultOnLearning: false,
  },
  {
    value: 'other',
    label: 'Other',
    prompt: (n) => `Notes recall for "${n}".`,
    description: 'Free-form.',
    defaultOnLearning: false,
  },
]

export const CARD_KIND_LABEL: Record<CardKind, string> = Object.fromEntries(
  CARD_KIND_META.map((m) => [m.value, m.label]),
) as Record<CardKind, string>

export const CARD_KIND_BY_VALUE: Record<CardKind, CardKindMeta> = Object.fromEntries(
  CARD_KIND_META.map((m) => [m.value, m]),
) as Record<CardKind, CardKindMeta>

export const RATING_LABELS = ['', 'Again', 'Hard', 'Good', 'Easy'] as const

export const RATING_KEYS: Record<string, 1 | 2 | 3 | 4> = {
  '1': 1,
  '2': 2,
  '3': 3,
  '4': 4,
}
