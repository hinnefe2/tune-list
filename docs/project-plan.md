# Fiddle Tune Tracker — Project Plan

A personal web app for tracking old-time fiddle tunes: the ones I want to learn, the ones I can lead in a jam, and the ones I'm trying not to forget. Replaces a fragmented system of phone notes, Spotify playlists, a Google Sheet, and an Anki deck.

## Goals

- One canonical list of tunes, with attributes (key, tuning, genre, status).
- Track where each tune was first heard / who taught it (festivals, jams, people).
- Quick-capture flow optimized for "I'm at a jam right now and someone just played a cool tune."
- A "what can I lead?" view for jam scenarios.
- Spaced-repetition practice for tunes I'm trying to retain.
- Multi-user from day one (eventually share with a couple friends), via Supabase RLS.

## Non-goals (for MVP)

- Audio recording capture from jams. Schema supports it; UI is a later phase.
- Embedded YouTube/looptube practice panes. Will use external links for now.
- "Guitar hero" mobile practice interface. Speculative, post-MVP.
- Friend sharing UI. Schema is ready (`library_shares` table); UI is later.
- Mobile native app. PWA-style mobile-friendly SPA is enough.

## Tech stack

| Layer | Choice | Notes |
|---|---|---|
| Frontend | Vue 3 + Vite | TypeScript throughout |
| State | Pinia | Auth, tunes, sources, UI, metronome stores |
| Routing | Vue Router | History mode |
| Styling | Tailwind CSS | Utility-first; no custom design system |
| UI components | PrimeVue *(optional)* | For complex inputs (autocomplete, datepicker) — hand-roll the rest |
| Backend | Supabase | Postgres + Auth + Storage + Realtime |
| Auth | Supabase Auth, Google OAuth provider | One provider, no email/password |
| Hosting | Cloudflare Pages | Free tier, GitHub auto-deploy |
| Source control | GitHub (private repo) | Push to `main` → auto-deploy |
| Type generation | `supabase gen types typescript` | Run in CI, commit generated types |

No backend API server. The frontend talks directly to Postgres via the Supabase JS client; RLS policies enforce per-user isolation. Supabase Edge Functions handle the rare cases that need server-side secrets (e.g. Spotify API for track autocomplete) — none of those are in MVP scope.

## Architecture

```
┌─────────────────────────────────┐
│   Vue 3 SPA (Cloudflare Pages)  │
│   ├── Pinia stores              │
│   ├── Vue Router                │
│   └── @supabase/supabase-js     │
└──────────────┬──────────────────┘
               │ HTTPS (PostgREST + Realtime WS)
               │
┌──────────────▼──────────────────┐
│         Supabase                │
│   ├── Postgres (RLS-secured)    │
│   ├── Auth (Google OAuth)       │
│   ├── Storage (score images,    │
│   │   future jam recordings)    │
│   └── Realtime (cross-device    │
│       sync)                     │
└─────────────────────────────────┘
```

## Data model

Full SQL schema lives in `schema.sql`. Top-level tables:

- **profiles** — mirrors `auth.users`; display name, etc.
- **tunes** — core entity; one row per tune per user.
- **sources** — festivals, jams, people, lessons, recordings.
- **tune_sources** — many-to-many: a tune was heard at many sources.
- **media_links** — audio/video/spotify/sheet_music/looptube/tab links per tune. Supports section anchors (A part / B part timestamps) and either external URL or Supabase Storage path.
- **cards** — Anki-style recall facets per tune (a_part, b_part, key, name_from_audio, etc.).
- **reviews** — one row per review event on a card; SM-2 state (ease, interval, next_review_on).
- **recordings** — placeholder for future jam-capture feature.
- **library_shares** — read-only access from owner to viewer (future feature, schema ready).

Every owned table has `user_id`. RLS policies use a `can_view(target_user_id)` predicate that returns true if the row is yours OR someone has shared their library with you. Writes are always restricted to your own rows.

## Features (MVP)

### Tunes
- List view with filters (status, key, genre, source) and sort options.
- Detail view with all media links, sources, notes, review history.
- Add/edit form (modal off the list view).
- Status enum: `wishlist` → `learning` → `can_follow` → `can_lead` → `forgotten`.

### Capture flow
- Mobile-first `/capture` view for fast jam entry.
- Required: tune name. Optional: source, key, notes.
- Source picker autocompletes from existing sources, with a "create new" option.
- Defaults source to your most recently used, key blank, status to `wishlist`.

### Sources
- CRUD on festivals/jams/people/lessons.
- Source detail view shows all tunes heard there.

### Media
- Add YouTube, Spotify, looptube, sheet music URLs to a tune.
- Upload sheet music images to a private Supabase Storage bucket.
- Embedded rendering: YouTube iframe with `start=` param, Spotify embed iframe, looptube link, image tag for sheet music.
- Section field on each media link: timestamp links can be tagged A / B / C / intro / etc.

### Practice (spaced repetition)
- Auto-generate default cards (a_part, b_part, key) when a tune moves to `can_lead`.
- Toggle other card types per tune.
- `/practice` view shows cards due today; queue mode steps through them.
- Card prompts vary by `kind`. Reveal shows reference (sheet music, timestamped clip, etc.).
- Self-rate: Again / Hard / Good / Easy. SM-2 computes new interval and next review date.

### Metronome
- Global utility, accessible from a floating button in the app shell.
- Tempo input, start/stop, tap-to-set-tempo.
- Web Audio API for the click; state in a Pinia store so it persists across navigation.

### Auth / users
- Google OAuth sign-in only.
- Auto-create profile row on signup (DB trigger).
- Sign-out, basic profile view.

## Build phases

Each phase should result in a working, deployable app that's slightly more useful than the last.

### Phase 0 — Setup (1 session)
- Create Supabase project; enable Google OAuth provider.
- Create GitHub repo.
- Scaffold Vue 3 + Vite + TypeScript + Tailwind project.
- Connect Cloudflare Pages to repo; verify auto-deploy.
- Run `schema.sql` in Supabase SQL editor.
- Run `supabase gen types typescript` and commit generated types.
- Configure environment variables (Supabase URL, anon key) in dev and Cloudflare.

### Phase 1 — Auth + app shell
- Supabase client singleton + auth composable.
- Login view with Google OAuth button.
- App shell: nav bar, route container, auth-aware header.
- Route guards: redirect unauthenticated users to `/login`.
- Profile view with sign-out.

### Phase 2 — Tunes core
- `/tunes` list view with filters and sorts.
- Tune detail view.
- Add/edit modal.
- Pinia tunes store with realtime subscription.
- `services/` directory with all Supabase queries organized by table.

### Phase 3 — Sources and media
- Sources CRUD.
- tune_sources linking UI on the tune detail page.
- Media links UI: add/edit/delete, with embed rendering per kind.
- Sheet music upload to a private `scores` storage bucket; signed URL retrieval.

### Phase 4 — Capture flow
- `/capture` mobile-optimized quick-add.
- Source autocomplete.

### Phase 5 — Spaced repetition
- Auto-generate default cards on tune status change.
- `/practice` view: due-cards queue, review UI per card kind, SM-2 algorithm composable.
- Toggle card kinds per tune from the detail view.

### Phase 6 — Metronome
- Pinia metronome store with Web Audio click.
- Floating button + popover in the app shell.

### Phase 7 — Polish
- Mobile responsiveness pass.
- Empty states, loading skeletons, error boundaries.
- Import script for the existing CSV (one-off).

### Future
- Friend sharing UI (Phase 8).
- Audio recording capture (Phase 9).
- Guitar hero practice mode (Phase 10, speculative).

## One-time setup checklist

- [ ] Create Supabase project (free tier).
- [ ] In Supabase: Authentication → Providers → enable Google. Provide OAuth credentials from Google Cloud Console.
- [ ] In Supabase SQL editor: run `schema.sql`.
- [ ] In Supabase Storage: create `scores` bucket (private, authenticated read/write).
- [ ] Create GitHub repo (private).
- [ ] Scaffold Vue project locally; commit and push.
- [ ] Connect Cloudflare Pages to the GitHub repo. Build command: `npm run build`. Output: `dist`.
- [ ] Add Cloudflare Pages env vars: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
- [ ] Add same env vars to local `.env.local`.
- [ ] Install Supabase CLI; run `supabase gen types typescript` and commit `types/database.ts`.
- [ ] Add Google OAuth redirect URLs to Google Cloud Console (both `localhost` for dev and the Cloudflare Pages domain).

## Suggested project structure

```
src/
├── main.ts
├── App.vue
├── router/
│   └── index.ts
├── stores/                 # Pinia
│   ├── auth.ts
│   ├── tunes.ts
│   ├── sources.ts
│   ├── ui.ts               # filters, sort, search
│   └── metronome.ts
├── services/               # all Supabase queries
│   ├── supabase.ts         # client singleton
│   ├── tunes.ts
│   ├── sources.ts
│   ├── media.ts
│   ├── cards.ts
│   ├── reviews.ts
│   └── storage.ts
├── composables/
│   ├── useAuth.ts
│   ├── useSpacedRepetition.ts   # SM-2
│   └── useEmbed.ts              # media_link → component
├── views/
│   ├── LoginView.vue
│   ├── TunesView.vue
│   ├── TuneDetailView.vue
│   ├── CaptureView.vue
│   ├── PracticeView.vue
│   ├── SourcesView.vue
│   └── ProfileView.vue
├── components/
│   ├── TuneList.vue
│   ├── TuneCard.vue
│   ├── TuneEditor.vue
│   ├── MediaEmbed.vue
│   ├── SourcePicker.vue
│   ├── ReviewCard.vue
│   ├── Metronome.vue
│   └── ui/                       # button, input, modal, etc.
└── types/
    └── database.ts               # generated by supabase CLI
```

## Things to know

**RLS is the security model.** Every Supabase query relies on RLS policies in `schema.sql`. Don't bypass it with the service role key from the browser. The anon key plus a logged-in session is what every request uses.

**Realtime is opt-in per table.** Enable it in the Supabase dashboard under Database → Replication for the tables that need cross-device sync (start with `tunes` and `cards`).

**Generated types are the single source of truth.** Re-run `supabase gen types typescript` whenever the schema changes; commit the result. Components import types from `types/database.ts`.

**Storage paths, not URLs.** For uploaded sheet music images, store the storage path in `media_links.storage_path` and resolve to a signed URL at view time via the Supabase client. URLs expire; paths don't.

**SM-2 is short.** ~15 lines. Don't reach for FSRS or external libraries unless you outgrow it.

**The capture flow is the point.** It's the highest-friction case in the current notes-app workflow. Every other view can be unpolished and the app still earns its keep if `/capture` is fast and reliable.

## Open questions to resolve before Phase 1

- Domain name? (Cloudflare Pages gives a `*.pages.dev` subdomain for free; custom domain optional.)
- PrimeVue or hand-rolled components? (Lean toward hand-rolled with Tailwind for an SPA this small.)
- Color/visual style? (Default Tailwind palette is fine to start; can theme later.)

---

*Companion file: `schema.sql` — full Postgres schema with RLS policies and triggers. Hand both files to Claude Code together.*
