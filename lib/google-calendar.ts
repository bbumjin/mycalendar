import type { SupabaseClient } from '@supabase/supabase-js';

type AccountRow = {
  id: string;
  user_id: string;
  provider: string;
  access_token: string;
  refresh_token: string | null;
  token_expires_at: string | null;
  selected_calendar_id: string | null;
};

type EventPayload = {
  title: string;
  start_time: string;
  end_time: string;
  location_text: string | null;
  notes: string | null;
  attendees: string[];
  reminders: { minutes_before: number }[];
};

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const CALENDAR_API = 'https://www.googleapis.com/calendar/v3';

export class GoogleSyncError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message);
  }
}

// Returns a non-expired access token; refreshes it if necessary and persists
// the new token + expiry back to calendar_accounts.
export async function withFreshGoogleToken(
  supabase: SupabaseClient,
  account: AccountRow
): Promise<string> {
  const expiresAt = account.token_expires_at ? new Date(account.token_expires_at).getTime() : 0;
  if (expiresAt > Date.now() + 60_000) {
    return account.access_token;
  }
  if (!account.refresh_token) {
    throw new GoogleSyncError('No refresh token — please reconnect Google.', 401);
  }
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new GoogleSyncError('Google OAuth not configured on the server.', 500);
  }
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: account.refresh_token,
      grant_type: 'refresh_token',
    }),
  });
  const body = await res.json();
  if (!res.ok || !body.access_token) {
    throw new GoogleSyncError(body.error_description || body.error || 'token refresh failed', 401);
  }
  const newExpiresAt = new Date(Date.now() + (body.expires_in ?? 3600) * 1000).toISOString();
  await supabase
    .from('calendar_accounts')
    .update({ access_token: body.access_token, token_expires_at: newExpiresAt })
    .eq('id', account.id);
  return body.access_token as string;
}

function eventBody(e: EventPayload) {
  return {
    summary: e.title,
    location: e.location_text || undefined,
    description: e.notes || undefined,
    start: { dateTime: e.start_time },
    end: { dateTime: e.end_time },
    attendees: e.attendees.length > 0 ? e.attendees.map((a) => ({ displayName: a })) : undefined,
    reminders: {
      useDefault: false,
      overrides: e.reminders.map((r) => ({ method: 'popup', minutes: r.minutes_before })),
    },
  };
}

export async function createGoogleEvent(
  supabase: SupabaseClient,
  account: AccountRow,
  event: EventPayload
): Promise<{ externalId: string }> {
  const token = await withFreshGoogleToken(supabase, account);
  const calendarId = account.selected_calendar_id || 'primary';
  const res = await fetch(`${CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(eventBody(event)),
  });
  const body = await res.json();
  if (!res.ok || !body.id) {
    throw new GoogleSyncError(body.error?.message || `Google API ${res.status}`, res.status);
  }
  return { externalId: body.id as string };
}

export async function updateGoogleEvent(
  supabase: SupabaseClient,
  account: AccountRow,
  externalId: string,
  event: EventPayload
): Promise<void> {
  const token = await withFreshGoogleToken(supabase, account);
  const calendarId = account.selected_calendar_id || 'primary';
  const res = await fetch(
    `${CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(externalId)}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(eventBody(event)),
    }
  );
  if (!res.ok && res.status !== 404) {
    const body = await res.json().catch(() => ({}));
    throw new GoogleSyncError(body.error?.message || `Google API ${res.status}`, res.status);
  }
}

export async function deleteGoogleEvent(
  supabase: SupabaseClient,
  account: AccountRow,
  externalId: string
): Promise<void> {
  const token = await withFreshGoogleToken(supabase, account);
  const calendarId = account.selected_calendar_id || 'primary';
  const res = await fetch(
    `${CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(externalId)}`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  if (!res.ok && res.status !== 404 && res.status !== 410) {
    const body = await res.json().catch(() => ({}));
    throw new GoogleSyncError(body.error?.message || `Google API ${res.status}`, res.status);
  }
}

// Fetch the list of calendars the user has on their connected Google account.
export async function listGoogleCalendars(
  supabase: SupabaseClient,
  account: AccountRow
): Promise<{ id: string; summary: string; primary?: boolean }[]> {
  const token = await withFreshGoogleToken(supabase, account);
  const res = await fetch(`${CALENDAR_API}/users/me/calendarList?minAccessRole=writer`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = await res.json();
  if (!res.ok) throw new GoogleSyncError(body.error?.message || `Google API ${res.status}`, res.status);
  type GoogleCalendarItem = { id?: string; summary?: string; primary?: boolean };
  return ((body.items as GoogleCalendarItem[] | undefined) || []).map((c) => ({
    id: c.id ?? '',
    summary: c.summary ?? c.id ?? '',
    primary: c.primary,
  }));
}
