import { NextResponse, type NextRequest } from 'next/server';
import { requireUser } from '@/lib/supabase/server';
import { deleteGoogleEvent, updateGoogleEvent, GoogleSyncError } from '@/lib/google-calendar';

export const runtime = 'nodejs';

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const { supabase, user } = await requireUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { data, error } = await supabase
    .from('events_with_reminders')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (error || !data) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json({ event: data });
}

type PatchBody = {
  title?: string;
  start_time?: string;
  end_time?: string;
  location_text?: string | null;
  attendees?: string[];
  notes?: string | null;
  reminders?: { minutes_before: number; method?: 'notification' | 'email' }[];
};

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const { supabase, user } = await requireUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as PatchBody;
  const { reminders, ...fields } = body;

  if (Object.keys(fields).length > 0) {
    const { error } = await supabase
      .from('events')
      .update(fields)
      .eq('id', id)
      .eq('user_id', user.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (Array.isArray(reminders)) {
    const { error: rpcErr } = await supabase.rpc('replace_event_reminders', {
      p_event_id: id,
      p_reminders: reminders.map((r) => ({
        minutes_before: r.minutes_before,
        method: r.method ?? 'notification',
      })),
    });
    if (rpcErr) return NextResponse.json({ error: rpcErr.message }, { status: 500 });
  }

  const { data } = await supabase
    .from('events_with_reminders')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();
  if (!data) return NextResponse.json({ error: 'not found' }, { status: 404 });

  // If the event is synced to a Google calendar, propagate the update.
  let syncWarning: string | null = null;
  if (data.calendar_account_id && data.external_event_id) {
    const { data: account } = await supabase
      .from('calendar_accounts')
      .select('id, user_id, provider, access_token, refresh_token, token_expires_at, selected_calendar_id')
      .eq('id', data.calendar_account_id)
      .eq('user_id', user.id)
      .single();
    if (account?.provider === 'google') {
      try {
        await updateGoogleEvent(supabase, account, data.external_event_id, {
          title: data.title,
          start_time: data.start_time,
          end_time: data.end_time,
          location_text: data.location_text,
          notes: data.notes,
          attendees: data.attendees ?? [],
          reminders: data.reminders ?? [],
        });
      } catch (e: unknown) {
        syncWarning = e instanceof GoogleSyncError ? e.message : 'Google sync failed';
      }
    }
  }

  return NextResponse.json({ event: data, sync_warning: syncWarning });
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const { supabase, user } = await requireUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  // Fetch first to learn whether we have a Google twin to delete remotely.
  const { data: event } = await supabase
    .from('events')
    .select('id, calendar_account_id, external_event_id')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (event?.calendar_account_id && event.external_event_id) {
    const { data: account } = await supabase
      .from('calendar_accounts')
      .select('id, user_id, provider, access_token, refresh_token, token_expires_at, selected_calendar_id')
      .eq('id', event.calendar_account_id)
      .eq('user_id', user.id)
      .single();
    if (account?.provider === 'google') {
      try {
        await deleteGoogleEvent(supabase, account, event.external_event_id);
      } catch {
        // Best-effort: don't block local delete if Google is unreachable.
      }
    }
  }

  const { error } = await supabase.from('events').delete().eq('id', id).eq('user_id', user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
