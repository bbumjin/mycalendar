import Link from 'next/link';
import { AppShell, PageTitle } from '@/components/AppShell';
import { EventCard } from '@/components/EventCard';
import { requireUser } from '@/lib/supabase/server';
import { DEFAULT_TZ, fmtDateLong } from '@/lib/time';
import { getKoreanHolidays } from '@/lib/holidays';
import { startOfDay, endOfDay } from 'date-fns';
import { fromZonedTime } from 'date-fns-tz';
import type { EventRow } from '@/lib/types';
import { Plus, ArrowLeft } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function DayPage({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params; // YYYY-MM-DD
  const { supabase, user } = await requireUser();
  if (!user) return null;

  const tz = DEFAULT_TZ;
  // [00:00, 23:59:59.999] of `date` in KST → UTC range
  const dayStartUtc = fromZonedTime(`${date}T00:00:00`, tz);
  const dayEndUtc = fromZonedTime(`${date}T23:59:59.999`, tz);

  const [{ data }, holidays] = await Promise.all([
    // EventCard needs reminders (count), so keep the view but select only the
    // columns the card renders instead of every event column.
    supabase
      .from('events_with_reminders')
      .select('id, title, start_time, end_time, all_day, location_text, source_provider, reminders')
      .eq('user_id', user.id)
      .gte('start_time', dayStartUtc.toISOString())
      .lte('start_time', dayEndUtc.toISOString())
      .order('start_time', { ascending: true }),
    getKoreanHolidays(),
  ]);

  const events = (data as EventRow[] | null) ?? [];
  const dateObj = new Date(`${date}T12:00:00`);
  const holidayName = holidays.names.get(date);

  return (
    <AppShell active="month" fabHref={`/quick-add?date=${date}`}>
      <div className="pt-6 pb-4 flex items-center gap-3">
        <Link href="/calendar" aria-label="월간으로" className="p-1.5 rounded-full hover:bg-[var(--surface-2)] -ml-1.5">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{fmtDateLong(dateObj)}</h1>
          {holidayName && <p className="text-rose-500 text-sm mt-0.5">{holidayName}</p>}
        </div>
      </div>

      {events.length === 0 ? (
        <Link href={`/quick-add?date=${date}`} className="card p-8 flex flex-col items-center gap-3 text-center hover:bg-[var(--surface-2)]">
          <Plus className="w-7 h-7" />
          <div className="font-medium">이 날 일정이 없어요</div>
          <p className="text-sm text-[var(--muted)]">탭하면 이 날짜로 빠른 추가가 열립니다.</p>
        </Link>
      ) : (
        <div className="space-y-2">
          {events.map((e) => (
            <EventCard key={e.id} event={e} />
          ))}
        </div>
      )}
    </AppShell>
  );
}
