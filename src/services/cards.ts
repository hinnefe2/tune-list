import { supabase } from '@/services/supabase'
import type { Database } from '@/types/database'
import type { CardKind } from '@/lib/card-options'

export type Card = Database['public']['Tables']['cards']['Row']
export type CardInsert = Database['public']['Tables']['cards']['Insert']
export type CardUpdate = Database['public']['Tables']['cards']['Update']

/** cards_with_state is a Postgres view: every column is nullable in the
 *  generated types, but the view's coalesce + the underlying cards table's
 *  NOT NULL columns mean these are always populated at runtime. We restate
 *  the practical shape here. */
export interface CardWithState {
  id: string
  user_id: string
  tune_id: string
  kind: CardKind
  enabled: boolean
  notes: string | null
  created_at: string
  last_review_id: string | null
  last_reviewed_at: string | null
  last_rating: number | null
  ease_factor: number
  interval_days: number
  next_review_on: string
}

export async function listCardsForTune(tuneId: string): Promise<Card[]> {
  const { data, error } = await supabase
    .from('cards')
    .select('*')
    .eq('tune_id', tuneId)
  if (error) throw error
  return data ?? []
}

export async function createCard(input: CardInsert): Promise<Card> {
  const { data, error } = await supabase
    .from('cards')
    .insert(input)
    .select('*')
    .single()
  if (error) throw error
  return data
}

export async function updateCard(id: string, patch: CardUpdate): Promise<Card> {
  const { data, error } = await supabase
    .from('cards')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw error
  return data
}

/** Toggle a card kind on a tune. If the card row exists, set `enabled`; if
 *  it doesn't, create it (only when enabling). */
export async function setCardEnabled(
  tuneId: string,
  userId: string,
  kind: CardKind,
  enabled: boolean,
  existing: Card | null,
): Promise<Card> {
  if (existing) return updateCard(existing.id, { enabled })
  if (!enabled) {
    // Disabling a card that doesn't exist — nothing to do; return a fake
    // disabled placeholder isn't useful. Caller shouldn't reach this.
    throw new Error('Cannot disable a card that does not exist')
  }
  return createCard({ user_id: userId, tune_id: tuneId, kind, enabled: true })
}

const TODAY_ISO_LOCAL = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Cards due today or earlier across all the user's tunes. */
export async function listDueCards(): Promise<CardWithState[]> {
  const today = TODAY_ISO_LOCAL()
  const { data, error } = await supabase
    .from('cards_with_state')
    .select('*')
    .eq('enabled', true)
    .lte('next_review_on', today)
    .order('next_review_on', { ascending: true })
  if (error) throw error
  return (data ?? []) as CardWithState[]
}

export async function getCardsWithStateForTune(tuneId: string): Promise<CardWithState[]> {
  const { data, error } = await supabase
    .from('cards_with_state')
    .select('*')
    .eq('tune_id', tuneId)
  if (error) throw error
  return (data ?? []) as CardWithState[]
}
