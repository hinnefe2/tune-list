-- Phase 5 — spaced repetition support
--
-- Apply this in the Supabase SQL editor on top of the existing schema.
-- Idempotent: safe to re-run.
-- After running, optionally re-run `supabase gen types typescript
-- --project-id <ref>` and overwrite src/types/database.ts (the cards_with_state
-- view will then be in the typed surface).

-- ---------------------------------------------------------------------------
-- Auto-create default cards when a tune enters 'learning'.
-- on conflict do nothing so re-entering 'learning' (e.g. forgotten → learning)
-- doesn't duplicate or reset existing cards.
-- ---------------------------------------------------------------------------
create or replace function ensure_default_cards()
returns trigger language plpgsql security invoker as $$
begin
  if new.status = 'learning'
     and (tg_op = 'INSERT' or old.status is distinct from 'learning')
  then
    insert into public.cards (user_id, tune_id, kind)
    values
      (new.user_id, new.id, 'a_part'),
      (new.user_id, new.id, 'b_part'),
      (new.user_id, new.id, 'key')
    on conflict (tune_id, kind) do nothing;
  end if;
  return new;
end; $$;

drop trigger if exists tunes_default_cards on tunes;
create trigger tunes_default_cards
  after insert or update of status on tunes
  for each row execute function ensure_default_cards();

-- ---------------------------------------------------------------------------
-- cards_with_state — every card joined to its most recent review (if any).
-- security_invoker=true so RLS on cards/reviews still applies through the view.
-- New cards (no review yet) get sensible SRS defaults that put them due today.
-- ---------------------------------------------------------------------------
create or replace view cards_with_state
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
from cards c
left join lateral (
  select * from reviews
   where reviews.card_id = c.id
   order by reviews.reviewed_at desc
   limit 1
) r on true;
