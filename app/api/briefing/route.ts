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

  // The window boundary uses the app's default zone (the briefing UI also groups
  // by it), so we no longer need a serial per-request profile lookup. Query the
  // base table with only the columns the briefing list renders.
  const now = new Date();
  const rangeEnd = endOfDay(addDays(toZonedTime(now, DEFAULT_TZ), 3));

  const { data: events } = await supabase
    .from('events')
    .select('id, title, start_time, location_text')
    .eq('user_id', user.id)
    .gte('start_time', now.toISOString())
    .lte('start_time', rangeEnd.toISOString())
    .order('start_time', { ascending: true });

  const list = (events as EventRow[] | null) ?? [];
  return NextResponse.json({ events: list });
}
