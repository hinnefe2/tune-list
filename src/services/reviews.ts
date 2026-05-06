import { supabase } from '@/services/supabase'
import type { Database } from '@/types/database'
import { applyRating, type Rating, type SrsState } from '@/composables/useSpacedRepetition'

export type Review = Database['public']['Tables']['reviews']['Row']
export type ReviewInsert = Database['public']['Tables']['reviews']['Insert']

/** Record a rating on a card. Looks up the latest prior review, runs SM-2,
 *  inserts the new review row. */
export async function recordReview(
  userId: string,
  cardId: string,
  rating: Rating,
): Promise<Review> {
  const { data: prior, error: priorErr } = await supabase
    .from('reviews')
    .select('*')
    .eq('card_id', cardId)
    .order('reviewed_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (priorErr) throw priorErr

  const priorState: SrsState | null = prior
    ? { ease: Number(prior.ease_factor), interval: prior.interval_days }
    : null
  const next = applyRating(priorState, rating)

  const insert: ReviewInsert = {
    user_id: userId,
    card_id: cardId,
    rating,
    ease_factor: next.ease,
    interval_days: next.interval,
    next_review_on: next.nextReviewOn,
  }

  const { data, error } = await supabase
    .from('reviews')
    .insert(insert)
    .select('*')
    .single()
  if (error) throw error
  return data
}
