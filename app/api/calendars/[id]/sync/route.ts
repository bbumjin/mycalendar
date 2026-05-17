import { NextResponse, type NextRequest } from 'next/server';
import { requireUser } from '@/lib/supabase/server';
import { pullGoogleEvents } from '@/lib/google-calendar';
import { pullMicrosoftEvents } from '@/lib/microsoft-calendar';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const { supabase, user } = await requireUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { data: account } = await supabase
    .from('calendar_accounts')
    .select('id, user_id, provider, access_token, refresh_token, token_expires_at, selected_calendar_id')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (!account) return NextResponse.json({ error: 'not found' }, { status: 404 });

  try {
    let result;
    if (account.provider === 'google') {
      result = await pullGoogleEvents(supabase, account);
    } else if (account.provider === 'microsoft') {
      result = await pullMicrosoftEvents(supabase, account);
    } else {
      return NextResponse.json({ error: `unsupported provider: ${account.provider}` }, { status: 400 });
    }
    return NextResponse.json({ ok: true, ...result });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'sync failed';
    await supabase
      .from('calendar_accounts')
      .update({ last_sync_error: msg })
      .eq('id', account.id);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
