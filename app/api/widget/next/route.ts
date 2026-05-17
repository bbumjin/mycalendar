import { NextResponse, type NextRequest } from 'next/server';
import { resolveWidgetUser } from '@/lib/widget-auth';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const auth = await resolveWidgetUser(req);
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const admin = getSupabaseAdminClient();
  const nowIso = new Date().toISOString();
  const { data } = await admin
    .from('events_with_reminders')
    .select('id, title, start_time, end_time, location_text, source_provider, reminders')
    .eq('user_id', auth.userId)
    .gte('start_time', nowIso)
    .order('start_time', { ascending: true })
    .limit(1);

  const event = data?.[0] ?? null;
  let recommended_reminder_at: string | null = null;
  if (event) {
    type R = { minutes_before: number };
    const reminders = (event.reminders ?? []) as R[];
    const maxBefore = reminders.reduce((m, r) => Math.max(m, r.minutes_before), 0);
    if (maxBefore > 0) {
      recommended_reminder_at = new Date(new Date(event.start_time).getTime() - maxBefore * 60_000).toISOString();
    }
  }
  return NextResponse.json({ event, recommended_reminder_at }, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
