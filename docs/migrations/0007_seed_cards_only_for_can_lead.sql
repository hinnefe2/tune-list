-- Seed A/B/Key cards only when a tune enters 'can_lead'.
--
-- Why: migration 0001 seeded cards on 'learning' and 0006 widened that to
-- 'can_lead' as well. In practice a tune you're still learning doesn't need
-- spaced repetition — you're drilling it anyway — so the practice queue filled
-- up with tunes that weren't yet worth reviewing. Cards should activate at the
-- point a tune is "known and worth not forgetting", which is 'can_lead'.
--
-- Entering any other status no longer creates cards. Leaving 'can_lead' does
-- not touch existing cards or their review history; use the per-card toggles
-- on the tune detail page for that.
--
-- Apply in the Supabase SQL editor. Idempotent (CREATE OR REPLACE FUNCTION;
-- the backfill is a no-op once run, and re-running only re-disables cards on
-- tunes that are still not in 'can_lead').

create or replace function public.ensure_default_cards()
returns trigger language plpgsql security invoker as $$
begin
  if new.status = 'can_lead'
     and (tg_op = 'INSERT' or old.status is distinct from new.status)
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

-- One-time cleanup: silence the cards the old rule created for tunes that
-- never reached 'can_lead'. `enabled = false` rather than a delete, so review
-- history survives (reviews cascade from cards) and the tune detail toggles
-- can switch any of them back on.
update public.cards c
set enabled = false
from public.tunes t
where c.tune_id = t.id
  and t.status <> 'can_lead'
  and c.enabled;
