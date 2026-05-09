-- Auto-create A/B/Key cards when a tune enters 'can_lead', not just 'learning'.
--
-- Why: the SRS goal is to never forget a tune once known, so 'can_lead' tunes
-- need cards too. We deliberately don't pre-seed any review state — a fresh
-- card is immediately due (see migration 0003), the user practices it once,
-- and rates Easy if they recall it well. SM-2 then spreads the next intervals
-- naturally (Easy on a fresh card → ~3 days → ~10 → ~36 …) without any
-- bespoke onboarding flow.
--
-- Apply in the Supabase SQL editor. Idempotent (CREATE OR REPLACE FUNCTION,
-- ON CONFLICT DO NOTHING on the backfill).

create or replace function public.ensure_default_cards()
returns trigger language plpgsql security invoker as $$
begin
  if new.status in ('learning', 'can_lead')
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

-- One-time backfill: create cards for tunes already sitting in can_lead.
-- Safe to re-run.
insert into public.cards (user_id, tune_id, kind)
select t.user_id, t.id, k.kind
from public.tunes t
cross join (values ('a_part'::card_kind), ('b_part'::card_kind), ('key'::card_kind)) k(kind)
where t.status = 'can_lead'
on conflict (tune_id, kind) do nothing;
