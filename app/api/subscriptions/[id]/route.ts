import { NextResponse, type NextRequest } from 'next/server';
import { requireUser } from '@/lib/supabase/server';

export const runtime = 'nodejs';

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const { supabase, user } = await requireUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  // Events linked via subscription_id are removed by ON DELETE CASCADE.
  const { error } = await supabase
    .from('calendar_subscriptions')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
