-- ============================================================================
-- Fiddle tune tracker — Supabase / Postgres schema
-- Multi-user from day one. RLS enforces per-user isolation.
-- Optional library_shares table lets friends read each other's libraries.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Profiles: mirrors auth.users so we can attach display names, etc.
-- (Create via a trigger on auth.users insert; example trigger at bottom.)
-- ---------------------------------------------------------------------------
create table profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Tunes — the core entity. One row per tune per user.
-- ---------------------------------------------------------------------------
create type tune_status as enum (
  'wishlist',  -- want to learn
  'learning',  -- working on it now
  'can_fake',  -- can play along but not lead
  'can_lead',  -- comfortable leading in a jam
  'forgotten'  -- used to know it; want to revive
);

create table tunes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  aka         text[] not null default '{}',     -- alternate spellings / variants
  key         text,                              -- 'A', 'D', 'Am', 'A modal', etc.
  alt_keys    text[] not null default '{}',     -- e.g. {'A','G'} for Big John McNeil
  tuning      text not null default 'GDAE',     -- 'GDAE', 'AEAE', 'ADAE', 'AEAC#', etc.
  genre       text,                              -- 'Old Time', 'Irish', ...
  status      tune_status not null default 'wishlist',
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index tunes_user_idx        on tunes(user_id);
create index tunes_user_status_idx on tunes(user_id, status);

-- ---------------------------------------------------------------------------
-- Sources — where a tune was heard / who taught it.
-- Festivals, recurring jams, people, lessons, recordings, etc.
-- ---------------------------------------------------------------------------
create type source_kind as enum (
  'festival',   -- Clifftop, Battlegrounds, White Oak
  'jam',        -- Borelli's, Backroom Fiddle Jam
  'person',     -- Eileen's brother, Rupert Deese
  'lesson',     -- Jan Fiddle TOTD 2024
  'recording',  -- album, youtube channel
  'other'
);

create table sources (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  kind        source_kind not null default 'other',
  occurred_on date,                              -- for one-shot events; null if recurring
  notes       text,
  created_at  timestamptz not null default now(),
  unique (user_id, name)                          -- prevents accidental duplicate "Borelli's"
);

create index sources_user_idx on sources(user_id);

-- ---------------------------------------------------------------------------
-- Tune ↔ Source: a tune can be heard at many places, a place hosts many tunes.
-- ---------------------------------------------------------------------------
create table tune_sources (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  tune_id    uuid not null references tunes(id)   on delete cascade,
  source_id  uuid not null references sources(id) on delete cascade,
  heard_on   date,                                -- e.g. specific Sunday at Borelli's
  notes      text,                                -- "John played it during the slow jam"
  created_at timestamptz not null default now(),
  unique (tune_id, source_id, heard_on)
);

create index tune_sources_tune_idx   on tune_sources(tune_id);
create index tune_sources_source_idx on tune_sources(source_id);

-- ---------------------------------------------------------------------------
-- Media links — audio, sheet music, youtube, looptube clips, tabs.
-- A tune can have many of each.
-- ---------------------------------------------------------------------------
create type media_kind as enum (
  'audio',
  'video',
  'spotify',     -- spotify track; frontend renders an embed iframe
  'sheet_music',
  'looptube',
  'tab',
  'other'
);

create table media_links (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  tune_id       uuid not null references tunes(id)     on delete cascade,
  -- Exactly one of url / storage_path must be set.
  -- url:          external link (youtube, spotify, tunearch, etc.)
  -- storage_path: object key in a Supabase Storage bucket (uploaded score images)
  url           text,
  storage_path  text,
  kind          media_kind not null default 'other',
  title         text,
  notes         text,
  -- Section anchor: 'A', 'B', 'C', 'AABB', 'intro', etc.
  -- Used for tunes where you want timestamps for each part of the tune.
  section       text,
  -- Optional clip range for looptube / video segments
  start_seconds numeric,
  end_seconds   numeric,
  created_at    timestamptz not null default now(),
  check ((url is not null) <> (storage_path is not null))
);

create index media_links_tune_idx on media_links(tune_id);

-- ---------------------------------------------------------------------------
-- Recordings — your own captured audio (future feature; supabase storage)
-- ---------------------------------------------------------------------------
create table recordings (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  tune_id          uuid references tunes(id)   on delete set null,  -- nullable: unknown tune
  source_id        uuid references sources(id) on delete set null,  -- where it was recorded
  storage_path     text not null,                                    -- path in storage bucket
  recorded_at      timestamptz not null default now(),
  duration_seconds int,
  notes            text,
  created_at       timestamptz not null default now()
);

create index recordings_user_idx on recordings(user_id);
create index recordings_tune_idx on recordings(tune_id);

-- ---------------------------------------------------------------------------
-- Cards — Anki-style "facets" of recall on a tune. A single tune has many
-- cards (A part, B part, key, name-from-audio, etc.), each with independent
-- spaced-repetition state.
-- ---------------------------------------------------------------------------
create type card_kind as enum (
  'a_part',          -- recall A-part melody
  'b_part',          -- recall B-part melody
  'c_part',          -- some tunes have a third part
  'key',             -- recall the key given the tune name
  'name_from_audio', -- name the tune from an audio prompt
  'source',          -- recall where you heard it / who taught it
  'other'
);

create table cards (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  tune_id    uuid not null references tunes(id)     on delete cascade,
  kind       card_kind not null,
  enabled    boolean not null default true,    -- toggle off without deleting history
  notes      text,
  created_at timestamptz not null default now(),
  unique (tune_id, kind)                        -- one card per kind per tune (start simple)
);

create index cards_user_idx on cards(user_id);
create index cards_tune_idx on cards(tune_id);

-- ---------------------------------------------------------------------------
-- Reviews — one row per review event on a card. Latest row = current state.
-- SM-2 algorithm; rating scale matches Anki: 1=Again, 2=Hard, 3=Good, 4=Easy.
-- ---------------------------------------------------------------------------
create table reviews (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  card_id         uuid not null references cards(id) on delete cascade,
  reviewed_at     timestamptz not null default now(),
  rating          int  not null check (rating between 1 and 4),
  -- SM-2 state after this review
  ease_factor     numeric not null default 2.5,
  interval_days   int     not null default 1,
  next_review_on  date    not null
);

create index reviews_due_idx  on reviews(user_id, next_review_on);
create index reviews_card_idx on reviews(card_id);

-- ---------------------------------------------------------------------------
-- Library shares — let a friend read your library (future feature).
-- ---------------------------------------------------------------------------
create table library_shares (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references auth.users(id) on delete cascade,
  viewer_id  uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (owner_id, viewer_id),
  check (owner_id <> viewer_id)
);

create index library_shares_viewer_idx on library_shares(viewer_id);

-- ============================================================================
-- Row-Level Security
-- Default: a user sees only their own rows. With a library_shares row pointing
-- (owner -> viewer), the viewer also sees the owner's rows (read-only).
-- ============================================================================

alter table profiles       enable row level security;
alter table tunes          enable row level security;
alter table sources        enable row level security;
alter table tune_sources   enable row level security;
alter table media_links    enable row level security;
alter table recordings     enable row level security;
alter table cards          enable row level security;
alter table reviews        enable row level security;
alter table library_shares enable row level security;

-- Reusable predicate: caller can view rows owned by target_user_id
-- if it's their own data, or someone who has shared with them.
create or replace function can_view(target_user_id uuid)
returns boolean
language sql stable security invoker
as $$
  select target_user_id = auth.uid()
      or exists (
        select 1 from library_shares
         where owner_id  = target_user_id
           and viewer_id = auth.uid()
      );
$$;

-- ---- Profiles ----
create policy profiles_select on profiles for select using (true);
create policy profiles_upsert on profiles for insert with check (id = auth.uid());
create policy profiles_update on profiles for update using (id = auth.uid());

-- ---- Generic per-user-owned tables ----
-- Pattern: SELECT via can_view, write only your own rows.

create policy tunes_select on tunes for select using (can_view(user_id));
create policy tunes_insert on tunes for insert with check (user_id = auth.uid());
create policy tunes_update on tunes for update using (user_id = auth.uid());
create policy tunes_delete on tunes for delete using (user_id = auth.uid());

create policy sources_select on sources for select using (can_view(user_id));
create policy sources_insert on sources for insert with check (user_id = auth.uid());
create policy sources_update on sources for update using (user_id = auth.uid());
create policy sources_delete on sources for delete using (user_id = auth.uid());

create policy tune_sources_select on tune_sources for select using (can_view(user_id));
create policy tune_sources_insert on tune_sources for insert with check (user_id = auth.uid());
create policy tune_sources_update on tune_sources for update using (user_id = auth.uid());
create policy tune_sources_delete on tune_sources for delete using (user_id = auth.uid());

create policy media_links_select on media_links for select using (can_view(user_id));
create policy media_links_insert on media_links for insert with check (user_id = auth.uid());
create policy media_links_update on media_links for update using (user_id = auth.uid());
create policy media_links_delete on media_links for delete using (user_id = auth.uid());

create policy recordings_select on recordings for select using (can_view(user_id));
create policy recordings_insert on recordings for insert with check (user_id = auth.uid());
create policy recordings_update on recordings for update using (user_id = auth.uid());
create policy recordings_delete on recordings for delete using (user_id = auth.uid());

-- Cards: visible per share rules; writeable only by owner.
create policy cards_select on cards for select using (can_view(user_id));
create policy cards_insert on cards for insert with check (user_id = auth.uid());
create policy cards_update on cards for update using (user_id = auth.uid());
create policy cards_delete on cards for delete using (user_id = auth.uid());

-- Reviews: keep these strictly private (no sharing). Your practice history
-- isn't useful to anyone else.
create policy reviews_select on reviews for select using (user_id = auth.uid());
create policy reviews_insert on reviews for insert with check (user_id = auth.uid());
create policy reviews_update on reviews for update using (user_id = auth.uid());
create policy reviews_delete on reviews for delete using (user_id = auth.uid());

-- Library shares: owner manages; viewer can see shares pointing at them.
create policy shares_select on library_shares for select
  using (owner_id = auth.uid() or viewer_id = auth.uid());
create policy shares_insert on library_shares for insert
  with check (owner_id = auth.uid());
create policy shares_delete on library_shares for delete
  using (owner_id = auth.uid());

-- ============================================================================
-- Helpful triggers
-- ============================================================================

-- Auto-create a profile row when a new auth user signs up
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email));
  return new;
end; $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Keep tunes.updated_at fresh
create or replace function touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

create trigger tunes_touch_updated
  before update on tunes
  for each row execute function touch_updated_at();

-- ---------------------------------------------------------------------------
-- Spaced repetition (Phase 5): auto-create default cards when a tune enters
-- 'learning', and a view that joins each card to its latest review for the
-- practice queue.
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

create trigger tunes_default_cards
  after insert or update of status on tunes
  for each row execute function ensure_default_cards();

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
