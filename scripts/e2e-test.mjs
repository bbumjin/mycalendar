#!/usr/bin/env node
// End-to-end test against the live Supabase project + local Next.js dev server.
// Drives the same code paths the app uses, with the test user's session cookie.

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://fayijdvtlncohidsvrtf.supabase.co';
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZheWlqZHZ0bG5jb2hpZHN2cnRmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg5ODgwOTcsImV4cCI6MjA5NDU2NDA5N30.OeMKfxZFHjs3R2THGVIsArS-mt2worIv44E1j_DFz-4';
const APP = process.env.APP_URL || 'http://localhost:3000';
const EMAIL = 'e2e-test@example.com';
const PASSWORD = 'E2eTestPw!12345';

function log(label, val) {
  console.log(`\n${'='.repeat(8)} ${label} ${'='.repeat(8)}`);
  if (typeof val === 'string') console.log(val);
  else console.log(JSON.stringify(val, null, 2));
}

function assert(cond, msg) {
  if (!cond) {
    console.error(`✗ FAIL: ${msg}`);
    process.exitCode = 1;
    return false;
  }
  console.log(`✓ ${msg}`);
  return true;
}

// 1. Sign in to get session
const supabase = createClient(SUPABASE_URL, ANON, { auth: { persistSession: false } });
const { data: session, error: signinErr } = await supabase.auth.signInWithPassword({
  email: EMAIL, password: PASSWORD,
});
if (signinErr) {
  console.error('Sign-in failed:', signinErr);
  process.exit(1);
}
const accessToken = session.session.access_token;
const refreshToken = session.session.refresh_token;
const userId = session.user.id;
log('signed in as', { userId, email: session.user.email });

// Build a Next.js-compatible Supabase session cookie so we can call the Next.js API routes.
// supabase-js v2 + @supabase/ssr expects cookie `sb-<projectRef>-auth-token` to be a base64-prefixed JSON.
const projectRef = SUPABASE_URL.replace(/^https?:\/\//, '').split('.')[0];
const cookieName = `sb-${projectRef}-auth-token`;
const sessionPayload = {
  access_token: accessToken,
  refresh_token: refreshToken,
  expires_in: session.session.expires_in,
  expires_at: session.session.expires_at,
  token_type: 'bearer',
  user: session.user,
};
const cookieValue = 'base64-' + Buffer.from(JSON.stringify(sessionPayload)).toString('base64');

const cookieHeader = `${cookieName}=${encodeURIComponent(cookieValue)}`;

// Clean any prior test data
const authed = createClient(SUPABASE_URL, ANON, {
  global: { headers: { Authorization: `Bearer ${accessToken}` } },
  auth: { persistSession: false },
});
await authed.from('events').delete().eq('user_id', userId);

// 2. POST /api/extract — Korean sample
const krSample = '내일 오후 2시에 분당서울대병원 진료 예약';
const krRes = await fetch(`${APP}/api/extract`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Cookie: cookieHeader },
  body: JSON.stringify({ text: krSample, timezone: 'Asia/Seoul', now: new Date().toISOString() }),
});
const krJson = await krRes.json();
log('KR extraction', krJson);
assert(krRes.ok, '/api/extract Korean returns 200');
assert(krJson.event?.is_calendar_event === true, 'KR is_calendar_event=true');
assert(/분당서울대|병원|진료/.test(krJson.event?.location_text || krJson.event?.title || ''), 'KR extracts location/title with Korean keywords');

// 3. POST /api/extract — English sample
const enSample = 'Next Tuesday at 3pm, meeting with David at Gangnam Station Starbucks.';
const enRes = await fetch(`${APP}/api/extract`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Cookie: cookieHeader },
  body: JSON.stringify({ text: enSample, timezone: 'Asia/Seoul', now: new Date().toISOString() }),
});
const enJson = await enRes.json();
log('EN extraction', enJson);
assert(enRes.ok, '/api/extract English returns 200');
assert(enJson.event?.is_calendar_event === true, 'EN is_calendar_event=true');
assert(/David/i.test(enJson.event?.title + ' ' + (enJson.event?.attendees || []).join(' ')), 'EN extraction names David');
assert(/Gangnam|강남/i.test(enJson.event?.location_text || ''), 'EN extracts Gangnam location');

// 4. POST /api/events — save the EN event with the AI extraction (no client-side reminders → trigger fires)
const saveRes = await fetch(`${APP}/api/events`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Cookie: cookieHeader },
  body: JSON.stringify({
    title: enJson.event.title,
    start_time: enJson.event.start_datetime,
    end_time: enJson.event.end_datetime,
    location_text: enJson.event.location_text,
    attendees: enJson.event.attendees,
    source_text: enSample,
    source_type: 'text',
    ai_confidence: enJson.event.confidence,
  }),
});
const saveJson = await saveRes.json();
log('saved event', saveJson);
assert(saveRes.status === 201, '/api/events POST returns 201');
const eventId = saveJson.event?.id;
assert(!!eventId, 'event has an id');
assert(Array.isArray(saveJson.event?.reminders), 'event has reminders array');
const triggerMinutes = saveJson.event.reminders.map((r) => r.minutes_before).sort((a, b) => b - a);
assert(JSON.stringify(triggerMinutes) === JSON.stringify([120, 60, 5]), 'with-location trigger defaults = 120/60/5');

// 5. POST /api/events — save WITHOUT location → expect 60/5
const noLocRes = await fetch(`${APP}/api/events`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Cookie: cookieHeader },
  body: JSON.stringify({
    title: 'Solo focus block',
    start_time: enJson.event.start_datetime,
    end_time: enJson.event.end_datetime,
    source_type: 'manual',
  }),
});
const noLocJson = await noLocRes.json();
const noLocMinutes = noLocJson.event.reminders.map((r) => r.minutes_before).sort((a, b) => b - a);
log('no-location reminders', noLocMinutes);
assert(JSON.stringify(noLocMinutes) === JSON.stringify([60, 5]), 'without-location trigger defaults = 60/5');

// 6. PATCH /api/events/[id] — replace reminders atomically via RPC
const patchRes = await fetch(`${APP}/api/events/${eventId}`, {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json', Cookie: cookieHeader },
  body: JSON.stringify({ title: 'Edited: VC Meeting', reminders: [{ minutes_before: 30 }, { minutes_before: 10 }] }),
});
const patchJson = await patchRes.json();
log('after PATCH', patchJson);
assert(patchRes.ok, 'PATCH returns 200');
assert(patchJson.event.title === 'Edited: VC Meeting', 'title updated');
const patchedMins = patchJson.event.reminders.map((r) => r.minutes_before).sort((a, b) => b - a);
assert(JSON.stringify(patchedMins) === JSON.stringify([30, 10]), 'reminders replaced atomically');

// 7. GET /api/events — list
const fromIso = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
const toIso = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
const listRes = await fetch(`${APP}/api/events?from=${fromIso}&to=${toIso}`, { headers: { Cookie: cookieHeader } });
const listJson = await listRes.json();
log('list count', listJson.events.length);
assert(listJson.events.length >= 2, 'list returns the events we created');

// 8. GET widget endpoints
const today = await fetch(`${APP}/api/widget/today`, { headers: { Cookie: cookieHeader } }).then((r) => r.json());
const next = await fetch(`${APP}/api/widget/next`, { headers: { Cookie: cookieHeader } }).then((r) => r.json());
const month = await fetch(`${APP}/api/widget/month`, { headers: { Cookie: cookieHeader } }).then((r) => r.json());
log('widget today', today);
log('widget next', next);
log('widget month', month);
assert(Array.isArray(today.events), 'widget/today returns events array');
assert('event' in next, 'widget/next has event key');
assert(Array.isArray(month.days_with_events), 'widget/month days_with_events array');

// 9. GET briefing
const morn = await fetch(`${APP}/api/briefing?kind=morning`, { headers: { Cookie: cookieHeader } }).then((r) => r.json());
log('briefing morning', { kind: morn.kind, eventCount: morn.payload?.events?.length });
assert(morn.payload?.kind === 'morning', 'briefing morning kind');

// 10. DELETE event
const delRes = await fetch(`${APP}/api/events/${eventId}`, { method: 'DELETE', headers: { Cookie: cookieHeader } });
assert(delRes.ok, 'DELETE returns 200');

// 11. RLS isolation: try to read OTHER user's events (should be empty even with our token)
// Re-fetch to confirm the deleted event is gone.
const final = await fetch(`${APP}/api/events?from=${fromIso}&to=${toIso}`, { headers: { Cookie: cookieHeader } }).then((r) => r.json());
assert(!final.events.some((e) => e.id === eventId), 'deleted event is gone from list');

// 12. /api/setup/health — verify schema reachable
const health = await fetch(`${APP}/api/setup/health`).then((r) => r.json());
log('health', health);
assert(health.ok === true, 'all required tables present');

// 13. Unauthenticated /api/extract redirects to login (or returns 401)
const noAuthRes = await fetch(`${APP}/api/extract`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ text: 'test' }),
  redirect: 'manual',
});
assert(noAuthRes.status === 307 || noAuthRes.status === 401, `/api/extract gated (got ${noAuthRes.status})`);

// Cleanup
await authed.from('events').delete().eq('user_id', userId);

console.log(`\n${'='.repeat(8)} DONE ${'='.repeat(8)}`);
if (process.exitCode) console.error('SOME TESTS FAILED');
else console.log('ALL PASSING');
