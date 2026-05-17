import { NextResponse, type NextRequest } from 'next/server';
import { requireUser } from '@/lib/supabase/server';
import { DEFAULT_TZ } from '@/lib/time';
import { startOfMonth, endOfMonth } from 'date-fns';
import { toZonedTime, formatInTimeZone } from 'date-fns-tz';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const { supabase, user } = await requireUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const tz = DEFAULT_TZ;
  const monthParam = req.nextUrl.searchParams.get('month');
  const anchor = monthParam
    ? toZonedTime(new Date(`${monthParam}-01T00:00:00+09:00`), tz)
    : toZonedTime(new Date(), tz);
  const from = startOfMonth(anchor);
  const to = endOfMonth(anchor);

  const { data } = await supabase
    .from('events')
    .select('start_time')
    .eq('user_id', user.id)
    .gte('start_time', from.toISOString())
    .lte('start_time', to.toISOString());

  const days = new Set<string>();
  for (const e of data ?? []) {
    days.add(formatInTimeZone(new Date(e.start_time as unknown as string), tz, 'yyyy-MM-dd'));
  }

  return NextResponse.json({
    month: formatInTimeZone(anchor, tz, 'yyyy-MM'),
    days_with_events: Array.from(days).sort(),
  });
}
