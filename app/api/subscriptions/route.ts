import { NextResponse, type NextRequest } from 'next/server';
import { requireUser } from '@/lib/supabase/server';
import { syncIcsSubscription, IcsSyncError } from '@/lib/ics-sync';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function GET() {
  const { supabase, user } = await requireUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { data, error } = await supabase
    .from('calendar_subscriptions')
    .select('id, name, ics_url, last_synced_at, last_sync_error, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ subscriptions: data ?? [] });
}

export async function POST(req: NextRequest) {
  const { supabase, user } = await requireUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { ics_url?: string; name?: string };
  const rawUrl = (body.ics_url || '').trim();
  if (!rawUrl) return NextResponse.json({ error: 'ics_url required' }, { status: 400 });

  const normalized = rawUrl.replace(/^webcal:\/\//i, 'https://');
  if (!/^https?:\/\//i.test(normalized)) {
    return NextResponse.json({ error: '올바른 URL이 아닙니다.' }, { status: 400 });
  }

  const { data: sub, error } = await supabase
    .from('calendar_subscriptions')
    .insert({
      user_id: user.id,
      name: body.name?.trim() || '구독 캘린더',
      ics_url: normalized,
    })
    .select('id, user_id, ics_url, name')
    .single();
  if (error || !sub) {
    return NextResponse.json({ error: error?.message ?? 'insert failed' }, { status: 500 });
  }

  // Initial sync immediately so the user sees events right away.
  try {
    const result = await syncIcsSubscription(supabase, sub);
    return NextResponse.json({ subscription: { id: sub.id, name: sub.name }, ...result }, { status: 201 });
  } catch (e: unknown) {
    const msg = e instanceof IcsSyncError ? e.message : '구독 동기화에 실패했습니다.';
    // Keep the subscription row so the user can fix the URL / retry, but report the error.
    return NextResponse.json({ subscription: { id: sub.id, name: sub.name }, error: msg }, { status: 200 });
  }
}
