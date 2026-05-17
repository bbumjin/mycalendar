import { NextResponse, type NextRequest } from 'next/server';
import { requireUser } from '@/lib/supabase/server';
import { buildICalendar } from '@/lib/ics';
import type { EventRow } from '@/lib/types';

export const runtime = 'nodejs';

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const { supabase, user } = await requireUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { data, error } = await supabase
    .from('events_with_reminders')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();
  if (error || !data) return NextResponse.json({ error: 'not found' }, { status: 404 });

  const event = data as EventRow;
  const body = buildICalendar([event], { name: event.title });
  const filename = `${event.title.replace(/[^\p{L}\p{N}_-]+/gu, '_').slice(0, 60) || 'event'}.ics`;

  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}
