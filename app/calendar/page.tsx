import { AppShell } from '@/components/AppShell';
import { CalendarView } from '@/components/CalendarView';
import { requireUser } from '@/lib/supabase/server';
import { getMonthGrid } from '@/lib/calendar-data';
import { DEFAULT_TZ } from '@/lib/time';
import { formatInTimeZone } from 'date-fns-tz';

export const dynamic = 'force-dynamic';

export default async function MonthPage(props: { searchParams: Promise<{ m?: string }> }) {
  const { m } = await props.searchParams;
  const { supabase, user } = await requireUser();
  if (!user) return null;

  // Render the initial month on the server (no client spinner on first paint);
  // CalendarView then navigates months client-side with prefetch + cache.
  const month = m && /^\d{4}-\d{2}$/.test(m) ? m : formatInTimeZone(new Date(), DEFAULT_TZ, 'yyyy-MM');
  const initialData = await getMonthGrid(supabase, user.id, month);

  return (
    <AppShell active="month">
      <CalendarView initialMonth={month} initialData={initialData} />
    </AppShell>
  );
}
