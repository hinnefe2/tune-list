-- Add a `priority` column to tunes for the Learn-tab queue ordering.
--
-- Semantics: lower numeric value sorts first. NULL means "not yet
-- prioritized" and sorts after all explicitly-prioritized tunes (NULLS LAST).
-- Tiebreaker: `name asc`.
--
-- The Learn view writes back integer priorities (1..N) for the visible list
-- whenever the user reorders, but the column is `numeric` so future
-- reorder logic could insert between two items with fractional values
-- without renumbering.
--
-- Apply in the Supabase SQL editor. Idempotent.

alter table public.tunes
  add column if not exists priority numeric;

create index if not exists tunes_user_priority_idx
  on public.tunes (user_id, priority);
