-- Rename the tune_status enum value 'can_fake' → 'can_follow'.
--
-- Apply in the Supabase SQL editor. Postgres supports renaming an enum value
-- in place since PG 10, so existing rows update transparently and no data
-- migration is needed.

alter type public.tune_status rename value 'can_fake' to 'can_follow';
