import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/supabase/server';
import { DEFAULT_TZ } from '@/lib/time';
import { startOfDay, endOfDay } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

export const runtime = 'nodejs';

export async function GET() {
  const { supabase, user } = await requireUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const tz = DEFAULT_TZ;
  const nowZ = toZonedTime(new Date(), tz);
  const from = startOfDay(nowZ).toISOString();
  const to = endOfDay(nowZ).toISOString();
  const { data } = await supabase
    .from('events_with_reminders')
    .select('id, title, start_time, end_time, location_text')
    .eq('user_id', user.id)
    .gte('start_time', from)
    .lte('start_time', to)
    .order('start_time', { ascending: true });
  return NextResponse.json({ events: data ?? [] });
}
