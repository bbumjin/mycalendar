import { NextResponse, type NextRequest } from 'next/server';
import { resolveWidgetUser } from '@/lib/widget-auth';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { DEFAULT_TZ } from '@/lib/time';
import { getKoreanHolidays } from '@/lib/holidays';
import { startOfMonth, endOfMonth } from 'date-fns';
import { toZonedTime, formatInTimeZone } from 'date-fns-tz';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const auth = await resolveWidgetUser(req);
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const admin = getSupabaseAdminClient();
  const tz = DEFAULT_TZ;
  const monthParam = req.nextUrl.searchParams.get('month');
  const anchor = monthParam
    ? toZonedTime(new Date(`${monthParam}-01T00:00:00+09:00`), tz)
    : toZonedTime(new Date(), tz);
  const from = startOfMonth(anchor);
  const to = endOfMonth(anchor);
  const monthStr = formatInTimeZone(anchor, tz, 'yyyy-MM');

  const [{ data }, holidayData] = await Promise.all([
    admin
      .from('events')
      .select('start_time')
      .eq('user_id', auth.userId)
      .gte('start_time', from.toISOString())
      .lte('start_time', to.toISOString()),
    getKoreanHolidays(),
  ]);

  const days = new Set<string>();
  for (const e of data ?? []) {
    days.add(formatInTimeZone(new Date(e.start_time as unknown as string), tz, 'yyyy-MM-dd'));
  }

  const holidays = Array.from(holidayData.dates).filter((d) => d.startsWith(monthStr)).sort();

  return NextResponse.json({
    month: monthStr,
    days_with_events: Array.from(days).sort(),
    holidays,
  }, { headers: { 'Cache-Control': 'no-store' } });
}
