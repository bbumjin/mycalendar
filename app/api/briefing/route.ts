import { NextResponse } from 'next/server';
import { requireUser } from '@/lib/supabase/server';
import { DEFAULT_TZ } from '@/lib/time';
import { addDays, endOfDay } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import type { EventRow } from '@/lib/types';

export const runtime = 'nodejs';

export async function GET() {
  const { supabase, user } = await requireUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { data: profile } = await supabase
    .from('profiles')
    .select('timezone')
    .eq('id', user.id)
    .single();
  const tz = profile?.timezone || DEFAULT_TZ;

  const now = new Date();
  const nowZ = toZonedTime(now, tz);
  const rangeEnd = endOfDay(addDays(nowZ, 3));

  const { data: events } = await supabase
    .from('events_with_reminders')
    .select('*')
    .eq('user_id', user.id)
    .gte('start_time', now.toISOString())
    .lte('start_time', rangeEnd.toISOString())
    .order('start_time', { ascending: true });

  const list = (events as EventRow[] | null) ?? [];
  return NextResponse.json({ events: list });
}
