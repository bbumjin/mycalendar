import { NextResponse, type NextRequest } from 'next/server';
import { requireUser } from '@/lib/supabase/server';
import { DEFAULT_TZ } from '@/lib/time';
import { startOfDay, endOfDay, addDays } from 'date-fns';
import { toZonedTime, formatInTimeZone } from 'date-fns-tz';
import type { EventRow } from '@/lib/types';

export const runtime = 'nodejs';

type Kind = 'morning' | 'night';

export async function GET(req: NextRequest) {
  const { supabase, user } = await requireUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const kind = (req.nextUrl.searchParams.get('kind') as Kind) || pickDefault();
  const { data: profile } = await supabase
    .from('profiles')
    .select('timezone')
    .eq('id', user.id)
    .single();
  const tz = profile?.timezone || DEFAULT_TZ;
  const nowZ = toZonedTime(new Date(), tz);
  const forDate = formatInTimeZone(nowZ, tz, 'yyyy-MM-dd');

  // Look for cached briefing row
  const { data: cached } = await supabase
    .from('briefings')
    .select('*')
    .eq('user_id', user.id)
    .eq('kind', kind)
    .eq('for_date', forDate)
    .single();

  if (cached) {
    return NextResponse.json({ kind, for_date: forDate, payload: cached.payload, cached: true });
  }

  // Compute on demand
  const dayStart = kind === 'morning' ? startOfDay(nowZ) : startOfDay(addDays(nowZ, 1));
  const dayEnd = endOfDay(dayStart);

  const { data: events } = await supabase
    .from('events_with_reminders')
    .select('*')
    .eq('user_id', user.id)
    .gte('start_time', dayStart.toISOString())
    .lte('start_time', dayEnd.toISOString())
    .order('start_time', { ascending: true });

  const list = (events as EventRow[] | null) ?? [];
  const payload = {
    kind,
    for_date: forDate,
    target_date: formatInTimeZone(dayStart, tz, 'yyyy-MM-dd'),
    events: list,
    first_event: list[0] ?? null,
    located_events: list.filter((e) => !!e.location_text),
  };

  // Best-effort cache for the day
  await supabase
    .from('briefings')
    .upsert({ user_id: user.id, kind, for_date: forDate, payload }, { onConflict: 'user_id,kind,for_date' });

  return NextResponse.json({ kind, for_date: forDate, payload, cached: false });
}

function pickDefault(): Kind {
  const h = new Date().getHours();
  return h < 14 ? 'morning' : 'night';
}
