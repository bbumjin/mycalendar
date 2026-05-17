# AI Calendar MVP — Implementation Plan

## 1. Scope & Strategy

**Product promise** (from brief): *"Create a properly reminded calendar event from any text or voice input in seconds."*

The brief lists Android (Kotlin + Compose + Glance widgets) and a Next.js web companion as must-haves. In a single agent session running on Linux/WSL2 we do **not** have an Android SDK, Gradle, or an emulator, so a buildable, testable native Android app is out of reach this pass.

What we **can** ship, end-to-end, in this session (Phase 1 — Web + Backend):

1. **Next.js 16 PWA** — installable on Android home screen, mobile-first design, paste/voice quick-add → AI extraction → confirmation → save. Includes in-app Today, Upcoming, Month, Event Detail, Settings, and a **Briefing** screen that renders the morning/night briefing content on demand and on a daily auto-open hook.
2. **Supabase backend** — Postgres schema with RLS, Supabase Auth (magic link), all server-side APIs.
3. **Supabase Edge Function `daily-briefing`** scheduled by pg_cron (08:00 and 22:00 KST) — computes morning/night briefing payloads and stores them so the web app surfaces them on next visit; Android client (Phase 2) consumes the same payload for native push.
4. **OpenAI integration** — gpt-4o-mini for event extraction, whisper-1 for voice.
5. **Reminders via Google Calendar sync** — when the user connects Google Calendar, our auto-reminders are attached to the synced event, so native notifications flow through Google Calendar's existing infrastructure on every Android phone, iOS, and the web. This satisfies the brief's reminder promise without us building an Android push pipeline.
6. **Outlook/Microsoft 365 stub** — `/api/auth/microsoft/start` and `/api/auth/microsoft/callback` exist with the same shape as Google, return 501 with setup hint if envs unset; schema and UI already support the second provider so completing Outlook in a follow-up is wiring only.
7. **`ANDROID_NEXT_PHASE.md`** — *not just a placeholder*; concretely contains:
   - REST endpoint contract table (URL, auth, request, response shape).
   - Widget data contract: `/api/widget/today`, `/api/widget/next`, `/api/widget/month` returning JSON the three Glance widgets bind to.
   - Module layout: `app/`, `data/`, `domain/`, `ui/`, `widget/`, `notifications/`.
   - WorkManager + AlarmManager job specs for the three default reminder offsets.
   - Phase-gate definition: Phase 2.A = today/upcoming/detail screens against API; Phase 2.B = three widgets; Phase 2.C = local notifications + briefings.

Phase 2 (Android native — out of this session, scaffolded by contract above) covers the brief's must-have Android surfaces: Kotlin/Compose app, three Glance widgets, AlarmManager-driven reminders, and native morning/night briefings.

This split is the only feasible cut given the session's environment, and it preserves every brief promise: web today, Android second pass against a frozen API contract. The reminder pipeline is **not** deferred — Google Calendar sync delivers cross-device notifications today.

## 2. Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 16 App Router + TypeScript | Brief requires it; supports SSR + API routes + PWA |
| UI | Tailwind CSS v4 + minimal custom components | Apple-style minimal aesthetic; no shadcn dependency overhead |
| Auth | Supabase Auth (magic link email) | Brief requires Supabase Auth; magic link is lowest friction |
| DB | Supabase Postgres + RLS | Brief requires it |
| Client SDK | `@supabase/ssr` + `@supabase/supabase-js` | App Router cookie pattern |
| AI | `ai` (Vercel AI SDK) + `@ai-sdk/openai` | Clean structured output via `generateObject` with zod schema |
| Voice | `openai` SDK direct call to whisper-1 | AI SDK doesn't wrap Whisper; native fetch fine |
| Date/TZ | `date-fns` + `date-fns-tz` | Korea-default timezone math |
| Icons | `lucide-react` | Lightweight, consistent |
| Calendar sync | `googleapis` Node client | Google first; Outlook deferred to nice-to-have but interface ready |
| PWA | Native Next.js metadata + manifest.webmanifest + minimal SW | No `next-pwa` plugin needed |

## 3. Database Schema

All tables in `public`, RLS enabled, every row keyed by `user_id = auth.uid()`.

```sql
-- profiles: 1:1 with auth.users
profiles (
  id uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  email text NOT NULL,
  display_name text,
  timezone text NOT NULL DEFAULT 'Asia/Seoul',
  default_calendar_account_id uuid,    -- set after connecting + selecting
  morning_briefing_time time DEFAULT '08:00',
  night_briefing_time time DEFAULT '22:00',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
)

-- calendar_accounts: Google/Microsoft connections
calendar_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('google','microsoft')),
  provider_account_email text NOT NULL,
  access_token text NOT NULL,           -- encrypted-at-rest by Supabase
  refresh_token text,
  token_expires_at timestamptz,
  selected_calendar_id text,            -- provider calendar id
  selected_calendar_name text,
  is_default boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (user_id, provider, provider_account_email)
)

-- events: drafts and saved/synced
events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  title text NOT NULL,
  start_time timestamptz NOT NULL,
  end_time timestamptz NOT NULL,
  all_day boolean DEFAULT false,
  location_text text,
  attendees text[] DEFAULT '{}',
  notes text,
  source_text text,                     -- original input
  source_type text DEFAULT 'manual',    -- 'text'|'voice'|'manual'
  ai_confidence numeric,
  needs_confirmation boolean DEFAULT true,
  status text NOT NULL DEFAULT 'saved', -- 'draft'|'saved'|'synced'|'failed'
  calendar_account_id uuid REFERENCES calendar_accounts ON DELETE SET NULL,
  external_event_id text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
)
CREATE INDEX events_user_time_idx ON events (user_id, start_time);

-- reminders: minutes_before; attached automatically
reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  minutes_before int NOT NULL,
  method text NOT NULL DEFAULT 'notification',   -- 'notification'|'email'
  created_at timestamptz DEFAULT now()
)
CREATE INDEX reminders_event_idx ON reminders (event_id);

-- voice_transcripts: optional, for debugging/learning
voice_transcripts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  transcript text NOT NULL,
  duration_seconds numeric,
  used_for_event_id uuid REFERENCES events ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
)
```

**RLS policies** (one canonical pattern per table):
```sql
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
CREATE POLICY events_owner ON events
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
-- repeat for calendar_accounts, reminders, voice_transcripts, profiles (id = auth.uid())
```

**Auto-create profile** on signup via trigger `on_auth_user_created` → INSERT into `profiles`.

**Default reminders trigger**: AFTER INSERT ON events → if `reminders` rows don't already exist for this event_id, insert defaults: when `location_text IS NOT NULL` → {120, 60, 5}; else → {60, 5}. This guarantees the brief's "automatic reminders" promise even if the client forgets to pass them.

### 3a. Briefings table

```sql
briefings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('morning','night')),
  for_date date NOT NULL,
  payload jsonb NOT NULL,                -- {events:[...], firstEvent:{...}, locatedEvents:[...]}
  created_at timestamptz DEFAULT now(),
  UNIQUE (user_id, kind, for_date)
)
```

A Supabase Edge Function `daily-briefing` runs every 15 minutes (via `pg_cron`). Each run selects users whose `profiles.morning_briefing_time` or `night_briefing_time` falls within a ±7-minute window of the current time (translated through their `profiles.timezone`), computes the payload from `events`, and upserts the row. This honors per-user configurable briefing times without needing per-user cron entries. The web `/briefing` page reads today's row (and computes on-demand if missing, so it works before the cron fires). Android (Phase 2) consumes the same row via authenticated REST and renders a native notification.

## 4. API Surface (Next.js Route Handlers)

All routes use Supabase SSR client to authenticate the request via cookies. Service role is only used for the auth-user trigger and is never exposed to the browser.

| Route | Method | Purpose |
|---|---|---|
| `/api/extract` | POST | `{ text, timezone? }` → `{ event: <Extraction> }` via OpenAI |
| `/api/transcribe` | POST | multipart audio → `{ transcript }` via Whisper; persist transcript row, discard audio |
| `/api/events` | GET | `?from=&to=` → user's events in range |
| `/api/events` | POST | body event → insert + auto-reminders; if `calendar_account_id` set, sync to Google in background |
| `/api/events/[id]` | GET/PATCH/DELETE | single event; `PATCH` accepts optional `reminders: [{minutes_before, method}]` which atomically replaces the event's reminder rows |
| `/api/auth/google/start` | GET | redirect to Google OAuth (uses `GOOGLE_CLIENT_ID` env if present, else returns 501 with friendly setup link) |
| `/api/auth/google/callback` | GET | exchange code, store tokens in `calendar_accounts` |
| `/api/auth/microsoft/start` | GET | mirror of Google for Outlook; 501 with setup hint when envs unset |
| `/api/auth/microsoft/callback` | GET | mirror of Google callback |
| `/api/calendars` | GET | list connected calendars + provider calendar list |
| `/api/briefing` | GET | `?kind=morning\|night` → today's briefing row, computed on-demand if missing |
| `/api/widget/today` | GET | array of today's events for Android home widget consumption (Phase 2) |
| `/api/widget/next` | GET | next single upcoming event for the Next Event widget |
| `/api/widget/month` | GET | `?month=YYYY-MM` → array of dates that have events for the month widget |
| `/api/setup/health` | GET | returns `{ ok, missingTables[] }` so `/setup` can show a green/red badge per table |

**Extraction schema** (zod, mirrored by LLM via `generateObject`):
```ts
const Extraction = z.object({
  is_calendar_event: z.boolean(),
  title: z.string(),
  start_datetime: z.string(),     // ISO 8601 with offset
  end_datetime: z.string(),       // default = start + 1h if not stated
  location_text: z.string().optional(),
  attendees: z.array(z.string()).default([]),
  source_text_summary: z.string(),
  confidence: z.number().min(0).max(1),
  needs_user_confirmation: z.boolean(),
});
```

The LLM prompt includes `Current local time: <ISO>` and `User timezone: <tz>` so relative phrasing like "내일 오후 2시" resolves correctly.

## 5. Pages & UX

```
/                     Home / Today (hero today section + upcoming list)
/quick-add            Hero paste box + microphone   <-- the front door
/confirm              Confirmation card (in-memory hand-off from quick-add)
/event/[id]           Detail + edit + delete
/calendar             Month grid view
/briefing             Morning / night briefing preview (auto-redirects from / before 11am or after 9pm if user opens app)
/settings             Profile, timezone, default calendar, connections (Google+Microsoft), briefing times, reminder defaults
/setup                Health page: shows which Supabase tables are reachable; red banner with paste link if any missing
/login                Magic link sign-in
/auth/callback        Supabase Auth handshake
```

UX rules (Apple-style minimal):
- Quick Add is the default route after sign-in.
- One large textarea (autofocus), one microphone button, one primary CTA. No accordion of advanced options.
- Confirmation is a single tall card; Save is the primary button, Edit is a text-link.
- Reminder edit is chips, not a complex picker.
- Mobile-first: 100% width on small screens, max 480px on phone-ish, max 720px on desktop. Calendar grid is the only desktop-stretching page.

## 6. Build Order (with checkpoints)

| # | Step | Done when |
|---|---|---|
| 1 | Scaffold Next.js, install deps, write env template | `npm run dev` boots a hello page |
| 2 | Write `supabase/migrations/0001_init.sql` (incl. briefings) | File exists, syntactically valid |
| 3 | Apply migrations | `SELECT 1 FROM events LIMIT 1` succeeds with service role; see §8 |
| 3a | Build `/setup` health page + `/api/setup/health` | Visiting `/setup` shows all 6 tables green; if migration not applied, page shows red banner with one-click copy of SQL |
| 4 | Supabase client helpers + middleware + auth pages | Magic link login + protected route works in dev |
| 5 | `/api/extract` + zod schema | curl POST returns valid JSON for a Korean + English sample |
| 6 | Quick Add page (text-only) | Pasting text → confirmation card shown |
| 7 | `/api/events` POST + auto-reminders | Saving from confirmation creates row + reminders |
| 8 | Today list + Event detail | Saved event appears, opens, edits, deletes |
| 9 | `/api/transcribe` + mic UI | Voice recording → transcript prefilled into Quick Add |
| 10 | Month calendar view | Renders events on correct cells |
| 11 | Settings + Google OAuth + Microsoft OAuth stubs | Both connection rows appear if envs set; both gracefully degrade otherwise |
| 11a | Briefing page + `/api/briefing` + Edge Function file (deployed only if CLI auth available; otherwise documented) | `/briefing` renders today's morning briefing computed on demand from events |
| 12 | PWA manifest + theme + favicon | `manifest.webmanifest` linked; "Add to Home Screen" works on Android Chrome |
| 12a | Widget endpoints (`/api/widget/*`) | curl returns shape matching `ANDROID_NEXT_PHASE.md` widget contract |
| 13 | Write `ANDROID_NEXT_PHASE.md` with full module/widget/notification contract | File contains endpoint table, widget data contract, WorkManager + AlarmManager job specs |
| 14 | End-to-end manual test | All §10 flows green |
| 15 | Audit + fix loop | Code review score ≥ 90/100 |

## 7. Environment Variables (.env.local)

```
NEXT_PUBLIC_SUPABASE_URL=https://fayijdvtlncohidsvrtf.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon>
SUPABASE_SERVICE_ROLE_KEY=<service_role>
OPENAI_API_KEY=<from .env openai_gpt>
# Optional — features degrade gracefully if absent:
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback
```

The existing `/.env` file in repo uses lowercase keys (`supabase_url`, `openai_gpt`); we will write a `.env.local` with the standard Next.js naming derived from those values. The original `.env` stays untouched as the source of truth.

## 8. Applying the Supabase Migration

Cloud Supabase doesn't expose DDL via the public REST API, and we don't have the database password in `.env`. Three paths, in order of attempt:

1. **Supabase CLI with access token** — requires `SUPABASE_ACCESS_TOKEN` env. We won't assume it.
2. **Direct `pg` connection** — requires DB password. Won't assume.
3. **Dashboard SQL Editor paste** — the migration is small enough to paste once. We will:
   - Write `supabase/migrations/0001_init.sql` with full DDL + RLS.
   - Print a clear instruction block at the end of implementation telling the user to open the project's SQL Editor and paste the file.
   - After paste, the app will detect missing tables and show a friendly setup banner with the URL, so first-run isn't a blank failure.

Verification: app pings `select count(*) from events` (with anon, fails closed by RLS, but the *error code* differs between "table missing" and "RLS denial"). We'll surface that in a `/setup` health page.

## 9. Reminder Strategy

Per brief: events without location → {60, 5}, with location → {120, 60, 5}.

- The DB trigger sets defaults on insert.
- The UI shows a `<ReminderEditor />` with these chips and lets users toggle / add custom.
- When the event has a `calendar_account_id`, we POST the event to Google Calendar including these reminders as `reminders.overrides`. Google handles cross-device notifications — this is how we satisfy "automatic reminders" without owning a push pipeline.
- For events with no connected calendar, reminders are stored but not actively fired in MVP (web push is nice-to-have per brief). The UI will show "Connect Google Calendar to receive notifications across devices" as a soft prompt on the Today page when no account is connected.

## 10. Test Plan (manual, must all pass)

1. **Sign in** with magic link → land on Today.
2. **Paste English** "Next Tuesday at 3pm, meeting with David at Gangnam Station Starbucks." → extraction shows next Tuesday at 15:00 KST, title contains "David", location contains "Gangnam".
3. **Paste Korean** "내일 오후 2시에 분당서울대병원 진료 예약" → extraction shows tomorrow at 14:00 KST, location contains "분당서울대병원".
4. **Save** → return to Today, event visible at correct slot.
5. **Open event** → detail page shows reminders 120/60/5 (location present).
6. **Edit title** → save → list reflects update.
7. **Voice** → record "Lunch with Yuna tomorrow at noon" → transcript appears, extraction runs, confirmation shown.
8. **Delete event** → removed from list.
9. **Month view** → event shows on its day with a dot.
10. **Settings** → can change timezone; toggle reflected in extraction.
11. **Offline shell** — `manifest.webmanifest` loads; app starts from home-screen icon on Android Chrome.

## 11. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Cannot apply DDL directly to Supabase | Migration SQL + `/setup` health page that polls table presence + dashboard paste link with the SQL copyable |
| OpenAI returns malformed JSON | `generateObject` + zod enforces schema; on failure return `is_calendar_event=false` with the raw text |
| Korean date parsing edge cases | LLM is asked to output ISO with explicit offset; pre-prompt with current time + timezone |
| Voice recording browser compat | Use MediaRecorder, fall back to file-picker if unsupported |
| OAuth credentials not provided | API returns 501 with setup hint; Google/Microsoft connect buttons show "Add credentials to enable" |
| Google access token expiry (1h) | `refresh_token` stored in `calendar_accounts`; before each Google API call, helper `withFreshGoogleToken()` refreshes if `token_expires_at < now()+60s`; on refresh failure, event row marked `status='failed'` and user sees a re-auth banner |
| Reminders without provider sync don't notify | Surface this as a soft prompt on Today; not a regression, brief explicitly says web push is nice-to-have |
| RLS lockout during dev | Service-role client used only for the auth trigger and Whisper transcript-write fallback; user actions always go through anon + session cookie |
| Time zone bugs | Default `Asia/Seoul`, configurable in Settings, persisted in `profiles`, passed to extractor on every call |
| Edge Function deploy needs CLI auth | If `SUPABASE_ACCESS_TOKEN` absent, we ship the function source under `supabase/functions/daily-briefing/index.ts` with deploy instructions; `/api/briefing` computes on-demand so the UX works even when the scheduled function isn't deployed |
| Android development not in scope | Frozen API contract + widget JSON shapes documented in `ANDROID_NEXT_PHASE.md`; Phase 2 can start without any web-side changes |

## 12. ANDROID_NEXT_PHASE.md — Outline

To make the deferral concrete, `ANDROID_NEXT_PHASE.md` ships in this session with:

1. **Endpoint contract table** — every web API endpoint with URL, auth header, request shape, response shape, error codes.
2. **Widget JSON schemas** — exact JSON returned by `/api/widget/today`, `/api/widget/next`, `/api/widget/month`, plus a sample payload.
3. **Module layout** —
   - `app/` (Hilt app entry, navigation graph)
   - `data/` — Retrofit API client (bound to web endpoints in §4), Room database with entities `EventEntity`, `ReminderEntity`, `CalendarAccountEntity`, `BriefingEntity`; repository layer; WorkManager pulls `/api/events?from=now&to=now+30d` every 30 min and upserts by `id` (server wins on conflict).
   - `domain/` (use-cases: ExtractEvent, SaveEvent, ListToday, GetBriefing).
   - `ui/` (Compose screens: Today, QuickAdd, Confirm, Detail, Month, Settings).
   - `widget/` (3 Glance widgets bound to widget endpoints).
   - `notifications/` (AlarmManager + WorkManager bindings).
4. **Reminder pipeline** — AlarmManager schedules per event from `reminders` rows; WorkManager pulls deltas every 30 min from `/api/events?from=now&to=now+30d`.
5. **Briefings** — WorkManager periodic job at `morning_briefing_time` and `night_briefing_time` from profile, pulls `/api/briefing`, shows native push.
6. **Phase gates** — 2.A screens, 2.B widgets, 2.C reminders + briefings, each independently shippable against the frozen web API.

This document is a deliverable of this session.

## 13. Out of Scope (explicitly)

- Native Android app implementation (Phase 2; spec'd above).
- Outlook Graph event-create/sync controller (stub endpoint shipped; full implementation Phase 1.5).
- Email auto-reading (brief lists it as nice-to-have).
- Travel-time / departure reminder (nice-to-have).
- Web push notifications (nice-to-have; Google Calendar sync covers cross-device notifications today).

## 14. Definition of Done

- All §6 steps green.
- All §10 test cases pass on a clean browser.
- Lint + typecheck clean.
- Code audit score ≥ 90/100.
- README with quick-start: `pnpm install && pnpm dev`, env setup, migration paste step.
