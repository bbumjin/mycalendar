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

function isEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
}

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
  // Attendees: if the string looks like an email, send as { email }, otherwise as { displayName }.
  // Google sends invitation emails to entries that have an email field (when sendUpdates=all).
  const attendees = e.attendees
    .map((a) => a.trim())
    .filter((a) => a.length > 0)
    .map((a) =>
      isEmail(a)
        ? { email: a }
        : { displayName: a, email: `${a.replace(/\s+/g, '_').toLowerCase()}@noreply.invalid`, responseStatus: 'needsAction' as const }
    );
  return {
    summary: e.title,
    location: e.location_text || undefined,
    description: e.notes || undefined,
    start: { dateTime: e.start_time },
    end: { dateTime: e.end_time },
    attendees: attendees.length > 0 ? attendees : undefined,
    reminders: {
      useDefault: false,
      overrides: e.reminders.map((r) => ({ method: 'popup', minutes: r.minutes_before })),
    },
  };
}

function hasRealAttendeeEmails(e: EventPayload): boolean {
  return e.attendees.some((a) => isEmail(a));
}

export async function createGoogleEvent(
  supabase: SupabaseClient,
  account: AccountRow,
  event: EventPayload
): Promise<{ externalId: string }> {
  const token = await withFreshGoogleToken(supabase, account);
  const calendarId = account.selected_calendar_id || 'primary';
  const sendUpdates = hasRealAttendeeEmails(event) ? '?sendUpdates=all' : '';
  const res = await fetch(
    `${CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events${sendUpdates}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(eventBody(event)),
    }
  );
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
  const sendUpdates = hasRealAttendeeEmails(event) ? '?sendUpdates=all' : '';
  const res = await fetch(
    `${CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(externalId)}${sendUpdates}`,
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
    `${CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(externalId)}?sendUpdates=all`,
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

// ---------- PULL: import Google events INTO our DB ----------

type GoogleEvent = {
  id: string;
  status?: string; // 'cancelled' for tombstones
  summary?: string;
  location?: string;
  description?: string;
  start?: { dateTime?: string; date?: string; timeZone?: string };
  end?: { dateTime?: string; date?: string; timeZone?: string };
  attendees?: { email?: string; displayName?: string }[];
  reminders?: { useDefault?: boolean; overrides?: { method?: string; minutes?: number }[] };
  updated?: string;
};

// List ALL calendars the user can at least read (holidays, shared, secondary, etc.).
// Falls back to ['primary'] if the token lacks calendarList scope (older
// connections granted only calendar.events) so sync never hard-fails.
async function listAllReadableCalendars(token: string): Promise<{ id: string }[]> {
  const out: { id: string }[] = [];
  let pageToken: string | undefined;
  try {
    do {
      const url = new URL(`${CALENDAR_API}/users/me/calendarList`);
      url.searchParams.set('minAccessRole', 'reader');
      url.searchParams.set('maxResults', '250');
      if (pageToken) url.searchParams.set('pageToken', pageToken);
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      const body = await res.json();
      if (!res.ok) throw new GoogleSyncError(body.error?.message || `Google API ${res.status}`, res.status);
      type Item = { id?: string };
      for (const c of (body.items as Item[] | undefined) || []) {
        if (c.id) out.push({ id: c.id });
      }
      pageToken = body.nextPageToken;
    } while (pageToken);
  } catch {
    // Insufficient scope (calendar.events only) — fall back to primary.
    return [{ id: 'primary' }];
  }
  return out.length > 0 ? out : [{ id: 'primary' }];
}

export async function pullGoogleEvents(
  supabase: SupabaseClient,
  account: AccountRow,
  opts: { fromDays?: number; toDays?: number } = {}
): Promise<{ imported: number; deleted: number }> {
  const token = await withFreshGoogleToken(supabase, account);
  const fromDays = opts.fromDays ?? 30;
  const toDays = opts.toDays ?? 365;
  const timeMin = new Date(Date.now() - fromDays * 86400_000).toISOString();
  const timeMax = new Date(Date.now() + toDays * 86400_000).toISOString();

  // Pull from EVERY calendar the user has, so the unified view is complete.
  const calendars = await listAllReadableCalendars(token);

  let imported = 0;
  let deleted = 0;
  const seen = new Set<string>();

  for (const cal of calendars) {
    let pageToken: string | undefined;
    do {
      const url = new URL(`${CALENDAR_API}/calendars/${encodeURIComponent(cal.id)}/events`);
      url.searchParams.set('timeMin', timeMin);
      url.searchParams.set('timeMax', timeMax);
      url.searchParams.set('singleEvents', 'true');
      url.searchParams.set('orderBy', 'startTime');
      url.searchParams.set('maxResults', '250');
      if (pageToken) url.searchParams.set('pageToken', pageToken);

      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      const body = await res.json();
      if (!res.ok) {
        // A single calendar failing (e.g. lost access) shouldn't abort the whole sync.
        break;
      }

      const items: GoogleEvent[] = body.items || [];
      for (const item of items) {
        if (!item.id || item.status === 'cancelled') continue;

        const start = item.start?.dateTime || (item.start?.date ? `${item.start.date}T00:00:00Z` : null);
        const end = item.end?.dateTime || (item.end?.date ? `${item.end.date}T23:59:59Z` : null);
        if (!start || !end) continue;

        // Composite id so the same UID across different calendars never collides.
        const externalId = `${cal.id}::${item.id}`;
        seen.add(externalId);

        const attendees = (item.attendees || [])
          .map((a) => a.displayName || a.email)
          .filter((s): s is string => !!s && !s.endsWith('@noreply.invalid'));

        const upsertRow = {
          user_id: account.user_id,
          title: item.summary || '(제목 없음)',
          start_time: new Date(start).toISOString(),
          end_time: new Date(end).toISOString(),
          all_day: !!item.start?.date,
          location_text: item.location ?? null,
          attendees,
          notes: item.description ?? null,
          source_text: null,
          source_type: 'manual' as const,
          source_provider: 'google' as const,
          calendar_account_id: account.id,
          external_event_id: externalId,
          status: 'synced' as const,
          last_synced_at: new Date().toISOString(),
          needs_confirmation: false,
        };

        const { data: existing } = await supabase
          .from('events')
          .select('id')
          .eq('calendar_account_id', account.id)
          .eq('external_event_id', externalId)
          .maybeSingle();

        let eventId: string | null = null;
        if (existing) {
          const { error } = await supabase.from('events').update(upsertRow).eq('id', existing.id);
          if (!error) eventId = existing.id;
        } else {
          const { data: inserted, error } = await supabase
            .from('events')
            .insert(upsertRow)
            .select('id')
            .single();
          if (!error && inserted) eventId = inserted.id;
        }

        if (eventId) {
          const reminderMinutes: number[] = [];
          if (item.reminders?.overrides) {
            for (const r of item.reminders.overrides) {
              if (typeof r.minutes === 'number') reminderMinutes.push(r.minutes);
            }
          }
          await supabase.rpc('replace_event_reminders', {
            p_event_id: eventId,
            p_reminders: reminderMinutes.map((m) => ({ minutes_before: m, method: 'notification' })),
          });
          imported++;
        }
      }
      pageToken = body.nextPageToken;
    } while (pageToken);
  }

  // Remove google events for this account that vanished upstream (within the window).
  const { data: locals } = await supabase
    .from('events')
    .select('id, external_event_id')
    .eq('calendar_account_id', account.id)
    .eq('source_provider', 'google');
  for (const l of locals ?? []) {
    if (l.external_event_id && !seen.has(l.external_event_id)) {
      await supabase.from('events').delete().eq('id', l.id);
      deleted++;
    }
  }

  await supabase
    .from('calendar_accounts')
    .update({ last_synced_at: new Date().toISOString(), last_sync_error: null })
    .eq('id', account.id);

  return { imported, deleted };
}
