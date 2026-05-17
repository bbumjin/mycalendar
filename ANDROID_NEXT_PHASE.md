# Android — Phase 2 Implementation Contract

This document is the **frozen API contract** + module spec for the Android client. The web app and Supabase backend in this repository are designed so that a Kotlin team can begin Phase 2 without re-negotiating any interfaces.

Read this together with [`PLAN.md`](./PLAN.md) §12 (outline) and the requirements brief at the repo root.

---

## 1. Authentication

The Android app uses **Supabase Auth** with the same project. Two supported flows:

- **Magic link** — handled in-app via `auth.signInWithOtp(email)` and a deep-link `aicalendar://auth/callback?code=…`.
- **Anonymous** — `auth.signInAnonymously()` for instant trial (must be enabled in the Supabase project).

After sign-in, the client holds an `access_token` (JWT). Every REST call below sends `Authorization: Bearer <access_token>`. The `apikey: <SUPABASE_ANON_KEY>` header is always sent too (PostgREST requirement).

Refresh handling is provided by `gotrue-android` (or roll-your-own using `auth.refreshSession()` when the JWT is < 60s from expiry).

---

## 2. REST Endpoint Contract

Base URL: the Next.js deployment hosting this repo (e.g. `https://aicalendar.example.com`).

All responses are JSON. All times are RFC 3339 / ISO 8601 with offset. All errors return `{ error: string, hint?: string }` with an appropriate HTTP status. Auth required everywhere except `/api/setup/health`.

### 2.1 Event extraction

```
POST /api/extract
Body: { "text": string, "timezone"?: string, "now"?: string }
200:  { "event": Extraction }
```

`Extraction` schema:
```ts
{
  is_calendar_event: boolean,
  title: string,
  start_datetime: string,   // ISO with offset
  end_datetime: string,     // ISO with offset
  location_text?: string | null,
  attendees: string[],
  source_text_summary: string,
  confidence: number,       // 0..1
  needs_user_confirmation: boolean
}
```

### 2.2 Voice transcription

```
POST /api/transcribe
multipart/form-data:
  audio: <file>   (audio/webm or audio/mp4 or audio/m4a)
200:  { "transcript": string }
```

Android tip: use `MediaRecorder` with AAC in MP4 container; `Content-Type: audio/mp4`.

### 2.3 Events CRUD

```
GET    /api/events?from=ISO&to=ISO
        → { events: EventRow[] }
POST   /api/events
        Body: {
          title, start_time, end_time,
          location_text?, attendees?, notes?,
          source_text?, source_type?, ai_confidence?,
          reminders?: [{ minutes_before, method? }],
          calendar_account_id?
        }
        → 201 { event: EventRow }
GET    /api/events/:id    → { event: EventRow }
PATCH  /api/events/:id    Body: partial fields; if `reminders` present, it atomically replaces existing reminder rows
DELETE /api/events/:id    → { ok: true }
```

`EventRow`:
```ts
{
  id: string, user_id: string,
  title: string, start_time: string, end_time: string,
  all_day: boolean, location_text: string | null,
  attendees: string[], notes: string | null,
  source_text: string | null, source_type: 'text'|'voice'|'manual',
  ai_confidence: number | null,
  needs_confirmation: boolean,
  status: 'draft'|'saved'|'synced'|'failed',
  calendar_account_id: string | null,
  external_event_id: string | null,
  created_at: string, updated_at: string,
  reminders: [{ id: string, minutes_before: number, method: 'notification'|'email' }]
}
```

### 2.4 Calendar accounts

```
GET /api/calendars
  → { accounts: [{ id, provider, provider_account_email, selected_calendar_name, is_default, token_expires_at }] }
```

OAuth start/callback flows are web-only (open `Custom Tabs` and let the user complete in the browser). The web callback stores the tokens; the Android app reads them back via `/api/calendars`.

### 2.5 Briefings

```
GET /api/briefing?kind=morning|night
  → { kind, for_date, payload: BriefingPayload, cached: boolean }
```

`BriefingPayload`:
```ts
{ kind, target_date, events: EventRow[], first_event: EventRow | null, located_events: EventRow[] }
```

Behavior: returns the cached `briefings` row if present; otherwise computes on demand and stores it.

### 2.6 Widget endpoints

These power the three required home-screen widgets.

```
GET /api/widget/today
  → { events: [{ id, title, start_time, end_time, location_text }] }

GET /api/widget/next
  → { event: EventRow | null, recommended_reminder_at: string | null }

GET /api/widget/month?month=YYYY-MM
  → { month: 'YYYY-MM', days_with_events: string[] /* 'YYYY-MM-DD' */ }
```

### 2.7 Setup health

```
GET /api/setup/health
  → { ok: boolean, missing: string[], results: { [table]: { ok, error? } } }
```

Used by Android only as a diagnostic ping during onboarding.

---

## 3. Module Layout

```
:app                       (Hilt entry, NavGraph, MainActivity)
:core:design               (Compose tokens matching web: surface, accent, muted, border)
:core:net                  (Retrofit + OkHttp + JWT injection + auto-refresh)
:core:db                   (Room database)
:feature:today
:feature:quick-add
:feature:confirm
:feature:detail
:feature:month
:feature:settings
:feature:briefing
:widget                    (3 Glance app widgets)
:notifications             (AlarmManager + WorkManager bindings)
```

### 3.1 Room entities

```kotlin
@Entity(tableName = "events")
data class EventEntity(
    @PrimaryKey val id: String,
    val title: String,
    val startTime: Instant,
    val endTime: Instant,
    val locationText: String?,
    val notes: String?,
    val status: String,
    val updatedAt: Instant
)

@Entity(tableName = "reminders", indices = [Index("eventId")])
data class ReminderEntity(
    @PrimaryKey val id: String,
    val eventId: String,
    val minutesBefore: Int,
    val method: String
)

@Entity(tableName = "calendar_accounts")
data class CalendarAccountEntity(
    @PrimaryKey val id: String,
    val provider: String,
    val email: String,
    val displayName: String,
    val isDefault: Boolean
)

@Entity(tableName = "briefings", primaryKeys = ["kind", "forDate"])
data class BriefingEntity(
    val kind: String,
    val forDate: String,
    val payloadJson: String,
    val createdAt: Instant
)
```

**Sync strategy**: WorkManager periodic job every 30 min calls `GET /api/events?from=now&to=now+30d` and upserts into Room by `id`; **server wins on conflict** (`updatedAt`). A second job polls `/api/widget/next` every 15 min and reschedules AlarmManager alarms.

---

## 4. Reminder Pipeline

1. On event upsert into Room, the repository schedules an AlarmManager `setExactAndAllowWhileIdle()` for each `ReminderEntity` at `startTime - minutesBefore * 60000`.
2. The AlarmManager broadcast triggers `ReminderReceiver`, which posts a high-priority notification with channel `event_reminders`.
3. When the user deletes an event, the repository cancels all alarms keyed by `event:<id>:<minutesBefore>`.
4. When WorkManager pulls a delta, it cancels alarms for removed reminders and re-schedules added ones.

POST_NOTIFICATIONS permission (Android 13+) is requested at first run of `feature:today`.

---

## 5. Widgets (Jetpack Glance)

| Widget | Size | Data source | Refresh |
|---|---|---|---|
| `TodayScheduleWidget` | 4×2 | `/api/widget/today` | every 30 min + on app foreground |
| `NextEventWidget` | 4×2 | `/api/widget/next` | every 15 min + after every event mutation |
| `MonthlyWidget` | 4×4 (also 2×2 variant for mini) | `/api/widget/month` | daily + on month change |

All three call `GlanceAppWidget.updateAll(context)` via a `CoroutineWorker`. Tapping an event opens `EventDetailActivity` with the `id` as a deep-link.

---

## 6. Briefings on Android

A `WorkManager.PeriodicWorkRequest` with `setInitialDelay` aligned to the user's `morning_briefing_time` (read from Supabase profile) fires once per day, calls `GET /api/briefing?kind=morning`, and posts a native notification using the `first_event` of the payload. A second job handles `kind=night`.

---

## 7. Phase Gates

- **2.A — Core screens against the API**: Today, QuickAdd, Confirm, Detail, Month, Settings. Local cache via Room. No widgets, no notifications. Shippable as an internal alpha.
- **2.B — Widgets**: TodayScheduleWidget, NextEventWidget, MonthlyWidget. Refresh policies above.
- **2.C — Notifications**: AlarmManager reminders + WorkManager briefings. POST_NOTIFICATIONS permission.

Each gate is independently shippable. Web app does not change between gates.

---

## 8. Build Notes

- Kotlin 2.x + KSP, Compose BOM 2025.0+, Glance 1.1+, Hilt 2.x.
- `minSdk` 26 (Glance widget min), `targetSdk` 35.
- `BuildConfig.WEB_BASE_URL` and `BuildConfig.SUPABASE_ANON_KEY` injected via `local.properties`.
- ProGuard rules: keep Supabase + Retrofit DTOs.

That's the contract. Anything beyond §1–§8 is freedom of the Android team's design taste; anything inside must be honored exactly because the web app expects it.
