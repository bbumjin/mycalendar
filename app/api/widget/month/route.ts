import { NextResponse, type NextRequest } from 'next/server';
import { resolveWidgetUser } from '@/lib/widget-auth';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { DEFAULT_TZ } from '@/lib/time';
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

  const { data } = await admin
    .from('events')
    .select('start_time')
    .eq('user_id', auth.userId)
    .gte('start_time', from.toISOString())
    .lte('start_time', to.toISOString());

  const days = new Set<string>();
  for (const e of data ?? []) {
    days.add(formatInTimeZone(new Date(e.start_time as unknown as string), tz, 'yyyy-MM-dd'));
  }

  return NextResponse.json({
    month: formatInTimeZone(anchor, tz, 'yyyy-MM'),
    days_with_events: Array.from(days).sort(),
  }, { headers: { 'Cache-Control': 'no-store' } });
}
