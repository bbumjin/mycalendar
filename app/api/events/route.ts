import { NextResponse, type NextRequest } from 'next/server';
import { requireUser } from '@/lib/supabase/server';
import { createGoogleEvent, GoogleSyncError } from '@/lib/google-calendar';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const { supabase, user } = await requireUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const from = searchParams.get('from');
  const to = searchParams.get('to');

  let query = supabase
    .from('events_with_reminders')
    .select('*')
    .eq('user_id', user.id)
    .order('start_time', { ascending: true });
  if (from) query = query.gte('start_time', from);
  if (to) query = query.lte('start_time', to);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ events: data ?? [] });
}

type CreateBody = {
  title: string;
  start_time: string;
  end_time: string;
  location_text?: string | null;
  attendees?: string[];
  notes?: string | null;
  source_text?: string | null;
  source_type?: 'text' | 'voice' | 'manual';
  ai_confidence?: number | null;
  calendar_account_id?: string | null;
  reminders?: { minutes_before: number; method?: 'notification' | 'email' }[];
};

export async function POST(req: NextRequest) {
  const { supabase, user } = await requireUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as CreateBody;
  if (!body.title || !body.start_time || !body.end_time) {
    return NextResponse.json({ error: 'title, start_time, end_time required' }, { status: 400 });
  }

  // If no calendar_account_id supplied, fall back to the user's default account.
  let calendarAccountId = body.calendar_account_id ?? null;
  if (!calendarAccountId) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('default_calendar_account_id')
      .eq('id', user.id)
      .single();
    calendarAccountId = profile?.default_calendar_account_id ?? null;
  }

  const insertPayload = {
    user_id: user.id,
    title: body.title,
    start_time: body.start_time,
    end_time: body.end_time,
    location_text: body.location_text ?? null,
    attendees: body.attendees ?? [],
    notes: body.notes ?? null,
    source_text: body.source_text ?? null,
    source_type: body.source_type ?? 'manual',
    ai_confidence: body.ai_confidence ?? null,
    calendar_account_id: calendarAccountId,
    status: 'saved' as const,
  };

  const { data: inserted, error } = await supabase
    .from('events')
    .insert(insertPayload)
    .select('*')
    .single();

  if (error || !inserted) {
    return NextResponse.json({ error: error?.message ?? 'insert failed' }, { status: 500 });
  }

  // If client supplied a custom reminders array, replace the trigger-attached defaults atomically.
  if (Array.isArray(body.reminders)) {
    const { error: rpcErr } = await supabase.rpc('replace_event_reminders', {
      p_event_id: inserted.id,
      p_reminders: body.reminders.map((r) => ({
        minutes_before: r.minutes_before,
        method: r.method ?? 'notification',
      })),
    });
    if (rpcErr) return NextResponse.json({ error: rpcErr.message }, { status: 500 });
  }

  // Re-fetch the event with reminders for the sync payload + response.
  const { data: full } = await supabase
    .from('events_with_reminders')
    .select('*')
    .eq('id', inserted.id)
    .eq('user_id', user.id)
    .single();

  // Best-effort sync to Google Calendar if a calendar account is attached.
  let syncWarning: string | null = null;
  if (calendarAccountId && full) {
    const { data: account } = await supabase
      .from('calendar_accounts')
      .select('id, user_id, provider, access_token, refresh_token, token_expires_at, selected_calendar_id')
      .eq('id', calendarAccountId)
      .eq('user_id', user.id)
      .single();
    if (account?.provider === 'google') {
      try {
        const { externalId } = await createGoogleEvent(supabase, account, {
          title: full.title,
          start_time: full.start_time,
          end_time: full.end_time,
          location_text: full.location_text,
          notes: full.notes,
          attendees: full.attendees ?? [],
          reminders: full.reminders ?? [],
        });
        await supabase
          .from('events')
          .update({ external_event_id: externalId, status: 'synced' })
          .eq('id', inserted.id);
        full.external_event_id = externalId;
        full.status = 'synced';
      } catch (e: unknown) {
        await supabase.from('events').update({ status: 'failed' }).eq('id', inserted.id);
        syncWarning = e instanceof GoogleSyncError ? e.message : 'Google sync failed';
      }
    }
  }

  return NextResponse.json({ event: full, sync_warning: syncWarning }, { status: 201 });
}
