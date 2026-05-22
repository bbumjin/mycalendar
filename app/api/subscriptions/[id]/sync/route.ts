import { NextResponse, type NextRequest } from 'next/server';
import { requireUser } from '@/lib/supabase/server';
import { syncIcsSubscription, IcsSyncError } from '@/lib/ics-sync';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const { supabase, user } = await requireUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { data: sub } = await supabase
    .from('calendar_subscriptions')
    .select('id, user_id, ics_url')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();
  if (!sub) return NextResponse.json({ error: 'not found' }, { status: 404 });

  try {
    const result = await syncIcsSubscription(supabase, sub);
    return NextResponse.json({ ok: true, ...result });
  } catch (e: unknown) {
    const msg = e instanceof IcsSyncError ? e.message : '동기화에 실패했습니다.';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
