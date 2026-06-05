import { NextResponse, type NextRequest } from 'next/server';
import { requireUser } from '@/lib/supabase/server';
import { getMonthGrid } from '@/lib/calendar-data';

export const runtime = 'nodejs';

// Per-month grid data for the client-side calendar. Keeping month navigation on
// the client (fetch once, cache, switch instantly) is what makes < > feel
// instant instead of a full server navigation per month.
export async function GET(req: NextRequest) {
  const { supabase, user } = await requireUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const m = new URL(req.url).searchParams.get('m');
  if (!m || !/^\d{4}-\d{2}$/.test(m)) {
    return NextResponse.json({ error: 'm=YYYY-MM required' }, { status: 400 });
  }

  const grid = await getMonthGrid(supabase, user.id, m);
  return NextResponse.json(grid);
}
