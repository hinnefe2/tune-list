-- Make unreviewed cards always due, regardless of timezone.
--
-- Why: the view's coalesce previously used `current_date`, which is the DB
-- server's date (UTC for Supabase). The client filters `listDueCards` with
-- the user's local date (`TODAY_ISO_LOCAL`). For users west of UTC, a fresh
-- card created near midnight gets stamped with the server's "tomorrow",
-- vanishes from the practice queue. Replace the coalesce default with a
-- far-past date so unreviewed cards always pass the `<= today` filter; once
-- a card has at least one review, its `next_review_on` is computed in the
-- client's local time (see applyRating in useSpacedRepetition.ts) and
-- everything stays consistent.
--
-- Apply in the Supabase SQL editor. Idempotent (CREATE OR REPLACE VIEW).

create or replace view public.cards_with_state
with (security_invoker = true) as
select
  c.id,
  c.user_id,
  c.tune_id,
  c.kind,
  c.enabled,
  c.notes,
  c.created_at,
  r.id              as last_review_id,
  r.reviewed_at     as last_reviewed_at,
  r.rating          as last_rating,
  coalesce(r.ease_factor, 2.5)             as ease_factor,
  coalesce(r.interval_days, 0)             as interval_days,
  coalesce(r.next_review_on, '1970-01-01') as next_review_on
from public.cards c
left join lateral (
  select * from public.reviews
   where reviews.card_id = c.id
   order by reviews.reviewed_at desc
   limit 1
) r on true;
