import { NextResponse, type NextRequest } from 'next/server';
import { resolveWidgetUser } from '@/lib/widget-auth';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import type { EventRow } from '@/lib/types';

export const runtime = 'nodejs';

// Upcoming events with their reminder offsets, so the Android app can schedule
// local AlarmManager notifications independent of Google/Outlook.
export async function GET(req: NextRequest) {
  const auth = await resolveWidgetUser(req);
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const admin = getSupabaseAdminClient();
  const nowIso = new Date().toISOString();
  const toIso = new Date(Date.now() + 30 * 86400_000).toISOString();

  const { data } = await admin
    .from('events_with_reminders')
    .select('id, title, start_time, location_text, reminders')
    .eq('user_id', auth.userId)
    .gte('start_time', nowIso)
    .lte('start_time', toIso)
    .order('start_time', { ascending: true });

  const events = ((data as Pick<EventRow, 'id' | 'title' | 'start_time' | 'location_text' | 'reminders'>[] | null) ?? []).map((e) => ({
    id: e.id,
    title: e.title,
    start_time: e.start_time,
    location_text: e.location_text,
    reminders: (e.reminders ?? []).map((r) => ({ minutes_before: r.minutes_before })),
  }));

  return NextResponse.json({ events }, { headers: { 'Cache-Control': 'no-store' } });
}
