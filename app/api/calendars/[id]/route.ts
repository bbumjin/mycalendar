import { NextResponse, type NextRequest } from 'next/server';
import { requireUser } from '@/lib/supabase/server';

export const runtime = 'nodejs';

// PATCH: set as default
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const { supabase, user } = await requireUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { is_default?: boolean };
  if (body.is_default === true) {
    // unset default on all of this user's accounts, then set this one
    await supabase.from('calendar_accounts').update({ is_default: false }).eq('user_id', user.id);
    const { error } = await supabase
      .from('calendar_accounts')
      .update({ is_default: true })
      .eq('id', id)
      .eq('user_id', user.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    await supabase
      .from('profiles')
      .update({ default_calendar_account_id: id })
      .eq('id', user.id);
  }

  const { data } = await supabase
    .from('calendar_accounts')
    .select('id, provider, provider_account_email, selected_calendar_name, is_default')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();
  if (!data) return NextResponse.json({ error: 'not found' }, { status: 404 });
  return NextResponse.json({ account: data });
}

// DELETE: disconnect (remove row; future syncs stop; existing events keep external_event_id but
// will simply not be touched on Google going forward since calendar_account_id is set null by FK)
export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const { supabase, user } = await requireUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  // null out profile default if it pointed here
  await supabase
    .from('profiles')
    .update({ default_calendar_account_id: null })
    .eq('id', user.id)
    .eq('default_calendar_account_id', id);

  const { error } = await supabase
    .from('calendar_accounts')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
