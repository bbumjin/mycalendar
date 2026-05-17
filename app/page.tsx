import Link from 'next/link';
import { AppShell, PageTitle } from '@/components/AppShell';
import { EventCard } from '@/components/EventCard';
import { requireUser } from '@/lib/supabase/server';
import { fmtDateLong, DEFAULT_TZ } from '@/lib/time';
import { addDays, startOfDay, endOfDay } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import type { EventRow } from '@/lib/types';
import { Sparkles } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const { supabase, user } = await requireUser();
  if (!user) return null;

  const tz = DEFAULT_TZ;
  const nowZ = toZonedTime(new Date(), tz);
  const todayStart = startOfDay(nowZ);
  const todayEnd = endOfDay(nowZ);
  const weekEnd = endOfDay(addDays(todayStart, 7));

  const { data } = await supabase
    .from('events_with_reminders')
    .select('*')
    .eq('user_id', user.id)
    .gte('start_time', todayStart.toISOString())
    .lte('start_time', weekEnd.toISOString())
    .order('start_time', { ascending: true });

  const events = (data as EventRow[] | null) ?? [];
  const today = events.filter((e) => new Date(e.start_time) <= todayEnd);
  const upcoming = events.filter((e) => new Date(e.start_time) > todayEnd);

  return (
    <AppShell active="today">
      <PageTitle sub={fmtDateLong(new Date())}>오늘</PageTitle>

      {today.length === 0 ? (
        <EmptyToday />
      ) : (
        <div className="space-y-2">
          {today.map((e) => (
            <EventCard key={e.id} event={e} />
          ))}
        </div>
      )}

      <h2 className="mt-10 mb-3 text-sm uppercase tracking-wide text-[var(--muted)]">다가오는 일정</h2>
      {upcoming.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">이번 주 다른 일정이 없습니다.</p>
      ) : (
        <div className="space-y-2">
          {upcoming.map((e) => (
            <EventCard key={e.id} event={e} showDate />
          ))}
        </div>
      )}
    </AppShell>
  );
}

function EmptyToday() {
  return (
    <Link
      href="/quick-add"
      className="card p-8 flex flex-col items-center gap-3 text-center hover:bg-[var(--surface-2)]"
    >
      <Sparkles className="w-7 h-7" />
      <div className="font-medium">오늘 일정이 없어요</div>
      <p className="text-sm text-[var(--muted)] max-w-sm">
        메시지를 붙여넣거나 한 문장 입력하거나 말하면 캘린더가 준비됩니다.
      </p>
    </Link>
  );
}
