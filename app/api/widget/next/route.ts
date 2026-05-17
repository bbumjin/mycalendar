import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/supabase/server';

export const runtime = 'nodejs';

export async function GET() {
  const { supabase, user } = await requireUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const nowIso = new Date().toISOString();
  const { data } = await supabase
    .from('events_with_reminders')
    .select('id, title, start_time, end_time, location_text, reminders')
    .eq('user_id', user.id)
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
  return NextResponse.json({ event, recommended_reminder_at });
}
