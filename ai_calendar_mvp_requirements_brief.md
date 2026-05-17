# AI Calendar App MVP Requirements & Product Vision Brief

We want to build an MVP for an AI-first calendar app.

This is not just another calendar app.  
The core vision is:

> Create a properly reminded calendar event from any text or voice input in seconds.

The product should make calendar event creation almost effortless, and every created event should automatically include useful reminders.

The app should feel extremely simple, intuitive, and low-friction — closer to Apple’s product philosophy than a power-user productivity tool.

Advanced controls can exist inside the event detail screen, but the default event creation flow must be nearly frictionless.

The ideal UX:

- Paste text → AI extracts event → user taps Save
- Speak one sentence → Whisper transcribes → AI extracts event → user taps Save
- Every saved event automatically gets sensible reminders
- The user should not need to manually think about reminder settings for ordinary events
- The app should work on both mobile and PC/web
- Android home screen widgets should make the user’s schedule always glanceable

---

## Primary Product Goals

### 1. Make event creation as easy as possible

The app should allow users to create events from:

- Natural language text input
- Copy & pasted text from email, messenger, SMS, web pages, documents, etc.
- Voice input using OpenAI Whisper transcription
- Manual entry as a fallback, but not as the primary experience

The app should use an LLM to extract meeting/event information from messy natural language.

Example inputs:

```text
Next Tuesday at 3pm, meeting with David at Gangnam Station Starbucks.
```

```text
내일 오후 2시에 분당서울대병원 진료 예약
```

```text
금요일 저녁 7시 판교에서 민수랑 저녁
```

The app should extract:

- Event title
- Date
- Start time
- End time if available
- Location if available
- People/attendees if available
- Original source text
- Confidence level
- Whether user confirmation is needed

The first version should always show a simple confirmation screen before saving.

---

### 2. Automatically attach useful reminders to every event

The app should automatically create reminders for all saved events.

Default reminder logic:

#### Events without location

Add:

- 1 hour before
- 5 minutes before

#### Events with location

For MVP:

- Add basic reminders first
- Use a more conservative reminder preset if location exists
- Example: 2 hours before, 1 hour before, 5 minutes before
- Travel-time calculation can be added later

The product principle is:

> The user should never have to remember to set a reminder manually.

---

### 3. Extreme ease of use

The default flow should be extremely simple.

Recommended UX:

#### Text flow

1. User opens app
2. User pastes text
3. AI extracts event
4. User sees a clean confirmation screen
5. User taps Save

No complex forms before AI extraction.

#### Voice flow

1. User taps microphone
2. User speaks one sentence
3. OpenAI Whisper transcribes the speech
4. AI extracts event information
5. User sees a clean confirmation screen
6. User taps Save

#### Manual edit

If AI gets something wrong, the user can tap into event details and edit:

- Title
- Date
- Time
- Location
- Reminder
- Calendar destination
- Notes

But this should be secondary.

The primary UX should be:

> Paste once and save.  
> Say once and save.

---

## MVP Calendar Integration

MVP should support:

- Google Calendar
- Outlook / Microsoft Calendar

Kakao Calendar is intentionally excluded from MVP because platform permissions and API constraints may slow down early development.

The app should be designed so that additional calendar providers can be added later.

Required integration capabilities:

- Sign in with calendar provider
- Read calendar list
- Select default calendar
- Create event
- Add reminders
- Sync created events
- Show upcoming events in the mobile app, web app, and Android widgets

Email auto-reading is not required for MVP.  
It can be considered later because Gmail/Outlook email access requires sensitive permissions and heavier review.

For MVP, copy & paste from email or messenger is enough.

---

## Platform Scope

### Android App

The Android app is the primary mobile experience.

Recommended stack:

- Kotlin
- Jetpack Compose
- Room local cache
- WorkManager
- AlarmManager
- Android Local Notifications
- Jetpack Glance / Android App Widget
- Google Calendar integration
- Microsoft Graph Calendar integration

The Android app should support:

- Quick text event creation
- Voice event creation
- Today screen
- Upcoming events screen
- Event detail/edit screen
- Local notification scheduling
- Home screen widgets

---

### PC / Web App

The PC/web version should be a lightweight companion app.

Recommended stack:

- Next.js
- PWA-friendly design
- Supabase Auth
- Supabase Postgres
- Same backend APIs as mobile

The web app should support:

- Login
- Paste-to-create event flow
- Voice recording through browser
- Event confirmation screen
- Calendar view
- Upcoming events
- Event detail/edit screen
- Calendar account connection/settings

The web app does not need to be a fully featured calendar replacement in MVP.  
Its primary job is to make text/voice event creation possible from a PC.

---

## Backend & Database

Recommended backend stack:

- Supabase Auth
- Supabase Postgres
- Supabase Edge Functions
- OpenAI API
- Google Calendar API
- Microsoft Graph API

Supabase should be the central backend for MVP because it provides:

- Postgres database
- Auth
- Row Level Security
- Edge Functions
- Fast MVP development
- Easy sharing between Android and web clients

The database should store:

- User accounts
- Connected calendar accounts
- Default calendar settings
- Event drafts
- AI extraction results
- Final saved event metadata
- Reminder preferences
- Device information
- Widget/cache data
- Voice transcripts

The app should avoid storing raw voice files long-term.

Recommended voice handling:

1. User records voice
2. Audio is sent to backend
3. Backend sends audio to OpenAI Whisper
4. Transcript is returned
5. Transcript is saved if useful
6. Raw audio file is discarded

OAuth tokens for Google/Microsoft calendar access must be stored securely and encrypted where appropriate.

---

## AI / LLM Requirements

The AI pipeline should be simple and structured.

### Text input flow

```text
User text
→ backend
→ LLM event extraction
→ structured JSON
→ confirmation screen
→ calendar save
```

### Voice input flow

```text
User voice
→ backend
→ OpenAI Whisper transcription
→ transcript
→ LLM event extraction
→ structured JSON
→ confirmation screen
→ calendar save
```

The LLM should return structured JSON only.

Example output:

```json
{
  "is_calendar_event": true,
  "title": "VC Meeting",
  "start_datetime": "2026-05-18T14:00:00+09:00",
  "end_datetime": "2026-05-18T15:00:00+09:00",
  "location_text": "Gangnam Station",
  "attendees": ["David"],
  "source_text_summary": "Meeting with David next Tuesday at 3pm near Gangnam Station",
  "confidence": 0.91,
  "needs_user_confirmation": true
}
```

The AI should not directly create the calendar event without user confirmation in MVP.

---

## Android Widgets

The app should include Android home screen widgets, especially for Samsung Galaxy users.

Widgets are important because the product should work as an always-visible personal schedule assistant.

### Widget 1: Today’s Schedule

Shows:

- Today’s date
- Upcoming events for today
- Next event highlighted
- Event time
- Event title
- Location if available

Tapping an event opens the event detail screen.

---

### Widget 2: Next Event / Departure Reminder

Shows:

- Next upcoming event
- Start time
- Location if available
- Recommended reminder/departure hint if available

Example:

```text
Next Event
2:00 PM VC Meeting
Gangnam Station

Reminder set: 12:00 PM
```

For MVP, travel-time calculation can be simple or omitted, but the UX should be designed for future travel-time-based alerts.

---

### Widget 3: Monthly Calendar Widget

Shows:

- Current month grid
- Today highlighted
- Dots or small indicators on days with events
- Tap a day to open that date in the app

MVP does not need complex interactions inside the widget.  
The widget should stay simple and glanceable.

Recommended widget sizes:

- 2x2: Mini month calendar
- 4x2: Today’s schedule
- 4x4: Full monthly calendar + today summary

---

## Notifications

The app should support automatic notifications.

### Event reminders

Default reminder rules:

- Events without location: 1 hour before, 5 minutes before
- Events with location: 2 hours before, 1 hour before, 5 minutes before

These should be automatically attached unless the user changes them in event detail.

### Morning briefing

Default: 8:00 AM

Shows:

- Today’s schedule
- First upcoming event
- Events with locations

### Night briefing

Default: 10:00 PM

Shows:

- Tomorrow’s schedule
- First event tomorrow
- Any early morning events

These times can be configurable later, but MVP can use sensible defaults.

---

## Product Philosophy

The app should not feel like a complicated productivity tool.

It should feel like:

- “I paste something, and my calendar is ready.”
- “I say something, and my calendar is ready.”
- “I never forget an event because reminders are automatic.”
- “My home screen always shows what matters next.”
- “I can use it on my phone or PC.”

Avoid:

- Too many settings
- Too many fields on the first screen
- Complex calendar configuration
- Power-user workflows in the main path
- Asking the user to manually set reminders every time
- Making the user choose too many options before saving

The MVP should optimize for:

1. Lowest user friction
2. Trustworthy event extraction
3. Automatic reminders
4. Simple mobile/web sync
5. Clear Android widgets
6. Simple daily briefings

---

## Suggested MVP Scope

### Must-have

- Supabase Auth
- Supabase Postgres
- Supabase Edge Functions
- Android app using Kotlin + Jetpack Compose
- PC/web app using Next.js
- Google Calendar integration
- Outlook Calendar integration
- Default calendar selection
- Natural language text event creation
- Paste-to-create flow
- Voice-to-create flow using OpenAI Whisper
- LLM event extraction
- Confirmation screen before save
- Automatic reminders
- Today schedule screen
- Upcoming events screen
- Event detail/edit screen
- Today schedule widget
- Next event widget
- Monthly calendar widget
- Morning briefing notification
- Night briefing notification

---

### Nice-to-have

- Location geocoding
- Estimated travel time
- Departure reminder based on route duration
- Gmail/Outlook email auto-reading
- Screenshot/image OCR event extraction
- Recurring event support
- Attendee invite support
- Web push notifications
- Paid subscription
- Multi-device notification preference sync

---

### Not required for MVP

- Kakao Calendar integration
- Full email inbox scanning
- Team scheduling
- Shared calendars beyond provider sync
- Complex availability search
- AI chat interface
- Admin dashboard
- Payment system
- Full calendar replacement UX
- Advanced productivity workflows

---

## Design Direction

The UI should be minimal, calm, and extremely clear.

Main screens:

1. Home / Today
2. Quick Add
3. Confirmation
4. Event Detail
5. Calendar Month View
6. Settings

The most important screen is Quick Add.

Quick Add should have:

- Large paste box
- Microphone button
- Simple extraction flow
- No complex form at first

Confirmation screen should show:

```text
Title
Date
Time
Location
Reminders
Calendar
Save button
Edit button
```

The Save button should be obvious.

---

## Key User Promise

The product promise is:

> Create a properly reminded calendar event from any text or voice input in seconds.

Everything in the MVP should support this promise.

When making product, architecture, or UX decisions, prioritize:

1. Lowest user friction
2. Trustworthy event extraction
3. Automatic reminders
4. Mobile and PC availability
5. Clear Android widgets
6. Low operating cost
7. Simple architecture

Do not overbuild.  
Do not create a complex productivity suite.  
Build the simplest possible AI calendar assistant that reliably turns messy input into useful, reminded calendar events.
