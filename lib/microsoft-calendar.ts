import type { SupabaseClient } from '@supabase/supabase-js';
import { addDays, parseISO } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { DEFAULT_TZ } from './time';

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
  all_day: boolean;
  location_text: string | null;
  notes: string | null;
  attendees: string[];
  reminders: { minutes_before: number }[];
};

const TOKEN_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';
const GRAPH = 'https://graph.microsoft.com/v1.0';
const SCOPES = 'Calendars.ReadWrite offline_access User.Read';

export class MicrosoftSyncError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message);
  }
}

function isEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
}

export async function withFreshMSToken(
  supabase: SupabaseClient,
  account: AccountRow
): Promise<string> {
  const expiresAt = account.token_expires_at ? new Date(account.token_expires_at).getTime() : 0;
  if (expiresAt > Date.now() + 60_000) return account.access_token;
  if (!account.refresh_token) {
    throw new MicrosoftSyncError('No refresh token — please reconnect Microsoft.', 401);
  }
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new MicrosoftSyncError('Microsoft OAuth not configured.', 500);
  }
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: account.refresh_token,
      grant_type: 'refresh_token',
      scope: SCOPES,
    }),
  });
  const body = await res.json();
  if (!res.ok || !body.access_token) {
    throw new MicrosoftSyncError(body.error_description || 'token refresh failed', 401);
  }
  const newExpiresAt = new Date(Date.now() + (body.expires_in ?? 3600) * 1000).toISOString();
  await supabase
    .from('calendar_accounts')
    .update({
      access_token: body.access_token,
      refresh_token: body.refresh_token ?? account.refresh_token,
      token_expires_at: newExpiresAt,
    })
    .eq('id', account.id);
  return body.access_token as string;
}

function calendarPath(account: AccountRow) {
  // Microsoft Graph: GET/POST /me/calendars/{id}/events for non-primary;
  // for primary, /me/calendar/events (singular).
  const id = account.selected_calendar_id;
  if (!id || id === 'primary') return '/me/calendar/events';
  return `/me/calendars/${encodeURIComponent(id)}/events`;
}

function buildEventJson(e: EventPayload) {
  const attendees = e.attendees
    .map((a) => a.trim())
    .filter(Boolean)
    .map((a) => ({
      emailAddress: {
        address: isEmail(a) ? a : `${a.replace(/\s+/g, '_').toLowerCase()}@noreply.invalid`,
        name: a,
      },
      type: 'required',
    }));
  // Reminder behavior in MS Graph: only one reminderMinutesBeforeStart per event.
  // We take the largest (earliest) reminder so the user gets the heads-up; subsequent
  // reminders are dropped on the MS side but kept locally.
  const reminderMinutes = e.reminders.reduce((m, r) => Math.max(m, r.minutes_before), 0);
  // MS Graph all-day events require isAllDay + midnight start/end in a named zone; end is EXCLUSIVE.
  const start = e.all_day
    ? { dateTime: `${formatInTimeZone(parseISO(e.start_time), DEFAULT_TZ, 'yyyy-MM-dd')}T00:00:00`, timeZone: DEFAULT_TZ }
    : { dateTime: e.start_time, timeZone: 'UTC' };
  const end = e.all_day
    ? { dateTime: `${formatInTimeZone(addDays(parseISO(e.end_time), 1), DEFAULT_TZ, 'yyyy-MM-dd')}T00:00:00`, timeZone: DEFAULT_TZ }
    : { dateTime: e.end_time, timeZone: 'UTC' };
  return {
    subject: e.title,
    body: { contentType: 'text', content: e.notes ?? '' },
    isAllDay: e.all_day,
    start,
    end,
    location: e.location_text ? { displayName: e.location_text } : undefined,
    attendees: attendees.length > 0 ? attendees : undefined,
    isReminderOn: reminderMinutes > 0,
    reminderMinutesBeforeStart: reminderMinutes > 0 ? reminderMinutes : undefined,
  };
}

export async function createMicrosoftEvent(
  supabase: SupabaseClient,
  account: AccountRow,
  event: EventPayload
): Promise<{ externalId: string }> {
  const token = await withFreshMSToken(supabase, account);
  const res = await fetch(`${GRAPH}${calendarPath(account)}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(buildEventJson(event)),
  });
  const body = await res.json();
  if (!res.ok || !body.id) {
    throw new MicrosoftSyncError(body.error?.message || `Graph ${res.status}`, res.status);
  }
  return { externalId: body.id as string };
}

export async function updateMicrosoftEvent(
  supabase: SupabaseClient,
  account: AccountRow,
  externalId: string,
  event: EventPayload
): Promise<void> {
  const token = await withFreshMSToken(supabase, account);
  const res = await fetch(`${GRAPH}/me/events/${encodeURIComponent(externalId)}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(buildEventJson(event)),
  });
  if (!res.ok && res.status !== 404) {
    const body = await res.json().catch(() => ({}));
    throw new MicrosoftSyncError(body.error?.message || `Graph ${res.status}`, res.status);
  }
}

export async function deleteMicrosoftEvent(
  supabase: SupabaseClient,
  account: AccountRow,
  externalId: string
): Promise<void> {
  const token = await withFreshMSToken(supabase, account);
  const res = await fetch(`${GRAPH}/me/events/${encodeURIComponent(externalId)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok && res.status !== 404 && res.status !== 410) {
    const body = await res.json().catch(() => ({}));
    throw new MicrosoftSyncError(body.error?.message || `Graph ${res.status}`, res.status);
  }
}

// ---------- PULL from Outlook into our DB ----------

type GraphEvent = {
  id: string;
  isCancelled?: boolean;
  subject?: string;
  bodyPreview?: string;
  body?: { content?: string };
  location?: { displayName?: string };
  start?: { dateTime?: string; timeZone?: string };
  end?: { dateTime?: string; timeZone?: string };
  attendees?: { emailAddress?: { address?: string; name?: string } }[];
  isAllDay?: boolean;
  reminderMinutesBeforeStart?: number;
  isReminderOn?: boolean;
};

export async function pullMicrosoftEvents(
  supabase: SupabaseClient,
  account: AccountRow,
  opts: { fromDays?: number; toDays?: number } = {}
): Promise<{ imported: number; deleted: number }> {
  const token = await withFreshMSToken(supabase, account);
  const fromDays = opts.fromDays ?? 30;
  const toDays = opts.toDays ?? 90;
  const start = new Date(Date.now() - fromDays * 86400_000).toISOString();
  const end = new Date(Date.now() + toDays * 86400_000).toISOString();

  // calendarView expands recurring events. /me/calendarView for primary calendar.
  let url: string | null =
    `${GRAPH}/me/calendarView?startDateTime=${encodeURIComponent(start)}&endDateTime=${encodeURIComponent(end)}&$top=250&$orderby=start/dateTime`;

  let imported = 0;
  const deleted = 0; // Graph delta is more involved; we accept additive sync for MVP.

  while (url) {
    const res: Response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Prefer: 'outlook.timezone="UTC"',
      },
    });
    const body = await res.json();
    if (!res.ok) {
      throw new MicrosoftSyncError(body.error?.message || `Graph ${res.status}`, res.status);
    }
    const items: GraphEvent[] = body.value || [];
    for (const item of items) {
      if (!item.id) continue;
      if (item.isCancelled) continue;

      const startIso = item.start?.dateTime ? new Date(item.start.dateTime + (item.start.dateTime.endsWith('Z') ? '' : 'Z')).toISOString() : null;
      const endIso = item.end?.dateTime ? new Date(item.end.dateTime + (item.end.dateTime.endsWith('Z') ? '' : 'Z')).toISOString() : null;
      if (!startIso || !endIso) continue;

      const attendees = (item.attendees || [])
        .map((a) => a.emailAddress?.name || a.emailAddress?.address)
        .filter((s): s is string => !!s && !s.endsWith('@noreply.invalid'));

      const upsertRow = {
        user_id: account.user_id,
        title: item.subject || '(제목 없음)',
        start_time: startIso,
        end_time: endIso,
        all_day: !!item.isAllDay,
        location_text: item.location?.displayName ?? null,
        attendees,
        notes: item.bodyPreview ?? null,
        source_text: null,
        source_type: 'manual' as const,
        source_provider: 'microsoft' as const,
        calendar_account_id: account.id,
        external_event_id: item.id,
        status: 'synced' as const,
        last_synced_at: new Date().toISOString(),
        needs_confirmation: false,
      };

      const { data: existing } = await supabase
        .from('events')
        .select('id')
        .eq('calendar_account_id', account.id)
        .eq('external_event_id', item.id)
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
        const reminders = item.isReminderOn && item.reminderMinutesBeforeStart
          ? [{ minutes_before: item.reminderMinutesBeforeStart, method: 'notification' }]
          : [];
        await supabase.rpc('replace_event_reminders', {
          p_event_id: eventId,
          p_reminders: reminders,
        });
        imported++;
      }
    }
    url = body['@odata.nextLink'] || null;
  }

  await supabase
    .from('calendar_accounts')
    .update({ last_synced_at: new Date().toISOString(), last_sync_error: null })
    .eq('id', account.id);

  return { imported, deleted };
}
