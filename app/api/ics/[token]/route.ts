import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { buildICalendar } from '@/lib/ics';
import { addDays, startOfDay } from 'date-fns';
import type { EventRow } from '@/lib/types';

export const runtime = 'nodejs';

// Public endpoint authenticated only by the per-user token in the path.
// Returns a feed of the user's events (past 30 days + future 365 days).
export async function GET(_req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  if (!token || token.length < 16) {
    return NextResponse.json({ error: 'invalid token' }, { status: 404 });
  }

  const admin = getSupabaseAdminClient();

  const { data: profile } = await admin
    .from('profiles')
    .select('id, display_name, email')
    .eq('ics_token', token)
    .single();
  if (!profile) {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }

  const from = startOfDay(addDays(new Date(), -30)).toISOString();
  const to = startOfDay(addDays(new Date(), 365)).toISOString();

  const { data: events } = await admin
    .from('events_with_reminders')
    .select('*')
    .eq('user_id', profile.id)
    .gte('start_time', from)
    .lte('start_time', to)
    .order('start_time', { ascending: true });

  const body = buildICalendar((events as EventRow[] | null) ?? [], {
    name: 'AI 캘린더',
    description: `${profile.display_name || profile.email}님의 AI 캘린더 일정`,
    refreshIntervalMinutes: 60,
  });

  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      // 1 hour edge cache to absorb hammering by calendar clients that poll aggressively.
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=600',
    },
  });
}
