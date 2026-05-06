-- Drop 'source' and 'other' from the card_kind enum.
-- Apply in the Supabase SQL editor.
--
-- Postgres can't drop an enum value directly, and the cards_with_state view
-- references cards.kind, so we have to:
--   1. Drop the dependent view.
--   2. Delete any rows still using these kinds (shouldn't be any in dev).
--   3. Rename the existing enum, recreate it without the unwanted values,
--      retype the cards.kind column, drop the old enum.
--   4. Recreate the view.

drop view if exists public.cards_with_state;

delete from public.cards where kind in ('source', 'other');

alter type public.card_kind rename to card_kind__old;

create type public.card_kind as enum (
  'a_part',
  'b_part',
  'c_part',
  'key',
  'name_from_audio'
);

alter table public.cards
  alter column kind type public.card_kind using kind::text::public.card_kind;

drop type public.card_kind__old;

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
  coalesce(r.ease_factor, 2.5)        as ease_factor,
  coalesce(r.interval_days, 0)        as interval_days,
  coalesce(r.next_review_on, current_date) as next_review_on
from public.cards c
left join lateral (
  select * from public.reviews
   where reviews.card_id = c.id
   order by reviews.reviewed_at desc
   limit 1
) r on true;
