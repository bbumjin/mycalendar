import { NextResponse, type NextRequest } from 'next/server';
import { resolveWidgetUser } from '@/lib/widget-auth';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { DEFAULT_TZ } from '@/lib/time';
import { startOfDay, endOfDay } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const auth = await resolveWidgetUser(req);
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const admin = getSupabaseAdminClient();
  const tz = DEFAULT_TZ;
  const nowZ = toZonedTime(new Date(), tz);
  const from = startOfDay(nowZ).toISOString();
  const to = endOfDay(nowZ).toISOString();

  const { data } = await admin
    .from('events_with_reminders')
    .select('id, title, start_time, end_time, location_text, source_provider')
    .eq('user_id', auth.userId)
    .gte('start_time', from)
    .lte('start_time', to)
    .order('start_time', { ascending: true });

  return NextResponse.json({ events: data ?? [] }, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
