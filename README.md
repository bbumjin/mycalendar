# AI Calendar — MVP

Create a properly reminded calendar event from any text or voice input in seconds.

Built per the requirements brief in this repo. See [`PLAN.md`](./PLAN.md) for the full plan and [`ANDROID_NEXT_PHASE.md`](./ANDROID_NEXT_PHASE.md) for the Phase 2 Android contract.

## Quick start

```bash
npm install
npm run dev
```

Open <http://localhost:3000>. You'll be redirected to `/login` first.

## First-run setup

1. **Configure environment.** `.env.local` is pre-populated from this repo's `.env`. Confirm `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and `OPENAI_API_KEY` are set.

2. **Apply the Supabase migration.** Already applied to this project. To re-apply or apply to a fresh project:

   ```bash
   PGPASSWORD="$SUPABASE_DB_PW" psql \
     -h aws-1-ap-northeast-2.pooler.supabase.com -p 5432 \
     -U "postgres.<project-ref>" -d postgres \
     -f supabase/migrations/0001_init.sql
   ```

   Or visit [`/setup`](http://localhost:3000/setup) — it surfaces the SQL inline with a one-click link to the project's SQL Editor.

3. **(Optional)** Add Google + Microsoft OAuth credentials in `.env.local` to enable calendar sync. The Connect buttons in `/settings` gracefully degrade when these are absent.

4. **(Optional)** Enable anonymous sign-in in your Supabase project's Auth settings to use the "Try anonymously" button.

## Architecture

- **Next.js 16 App Router PWA** — installable on Android home screen.
- **Supabase** — Postgres + RLS + Auth (magic link).
- **OpenAI** — `gpt-4o-mini` for event extraction (structured output via AI SDK + zod), `whisper-1` for voice.
- **Reminders via Google Calendar sync** — once a Google account is connected, our reminders attach to the synced event so notifications work across all the user's devices through native Google Calendar.
- **Daily briefings** — Supabase Edge Function `daily-briefing` runs every 15 min via `pg_cron`, computes the morning/night briefing payload per user, and stores it in `briefings`. The web app surfaces them at `/briefing`; Android Phase 2 consumes the same rows.

## Routes

| Path | Purpose |
|---|---|
| `/` | Today + upcoming list |
| `/quick-add` | Paste box + microphone — the hero front door |
| `/confirm` | Single-card confirmation before save |
| `/event/[id]` | Detail + edit + delete |
| `/calendar` | Month grid view |
| `/briefing` | Morning / night briefing |
| `/settings` | Profile, timezone, calendar connections |
| `/setup` | Schema health check + migration paste link |
| `/login` | Magic link sign-in |

## API (used by both web and Phase 2 Android)

See the full contract in [`ANDROID_NEXT_PHASE.md`](./ANDROID_NEXT_PHASE.md) §2.

- `POST /api/extract` — LLM event extraction
- `POST /api/transcribe` — Whisper voice transcription
- `GET/POST /api/events`, `GET/PATCH/DELETE /api/events/[id]`
- `GET /api/briefing?kind=morning|night`
- `GET /api/widget/today`, `/api/widget/next`, `/api/widget/month`
- `GET /api/calendars`
- OAuth: `/api/auth/google/{start,callback}`, `/api/auth/microsoft/{start,callback}`

## Project layout

```
app/                  Next.js routes + API
components/           Shared UI components
lib/                  Supabase clients, types, time utils
supabase/migrations/  0001_init.sql
supabase/functions/   daily-briefing Edge Function source
public/               Manifest + icons
```

## License

Private MVP — no license granted.
