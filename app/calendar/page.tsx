import Link from 'next/link';
import { AppShell } from '@/components/AppShell';
import { requireUser } from '@/lib/supabase/server';
import { DEFAULT_TZ, fmtTime, fmtMonthYear } from '@/lib/time';
import { addDays, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, format } from 'date-fns';
import { toZonedTime, formatInTimeZone } from 'date-fns-tz';
import type { EventRow } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function MonthPage(props: { searchParams: Promise<{ m?: string }> }) {
  const { m } = await props.searchParams;
  const { supabase, user } = await requireUser();
  if (!user) return null;

  const tz = DEFAULT_TZ;
  const today = toZonedTime(new Date(), tz);
  const anchor = m ? toZonedTime(new Date(`${m}-01T00:00:00+09:00`), tz) : today;
  const monthStart = startOfMonth(anchor);
  const monthEnd = endOfMonth(anchor);
  const gridStart = startOfWeek(monthStart);
  const gridEnd = endOfWeek(monthEnd);
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

  const { data } = await supabase
    .from('events_with_reminders')
    .select('*')
    .eq('user_id', user.id)
    .gte('start_time', gridStart.toISOString())
    .lte('start_time', addDays(gridEnd, 1).toISOString())
    .order('start_time', { ascending: true });

  const events = (data as EventRow[] | null) ?? [];
  const byDay = new Map<string, EventRow[]>();
  for (const e of events) {
    const key = formatInTimeZone(new Date(e.start_time), tz, 'yyyy-MM-dd');
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key)!.push(e);
  }

  const prevMonth = formatInTimeZone(addDays(monthStart, -1), tz, 'yyyy-MM');
  const nextMonth = formatInTimeZone(addDays(monthEnd, 1), tz, 'yyyy-MM');

  return (
    <AppShell active="month">
      <div className="pt-6 pb-4 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{fmtMonthYear(anchor)}</h1>
          <p className="text-[var(--muted)] mt-1 text-sm">{events.length}개 일정</p>
        </div>
        <div className="flex gap-2">
          <Link href={`/calendar?m=${prevMonth}`} className="btn-secondary !py-1.5 !px-3 text-sm">←</Link>
          <Link href={`/calendar`} className="btn-secondary !py-1.5 !px-3 text-sm">오늘</Link>
          <Link href={`/calendar?m=${nextMonth}`} className="btn-secondary !py-1.5 !px-3 text-sm">→</Link>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-px bg-[var(--border)] rounded-2xl overflow-hidden text-sm">
        {['일','월','화','수','목','금','토'].map((d, i) => (
          <div key={i} className="bg-[var(--surface-2)] py-2 text-center text-xs text-[var(--muted)]">{d}</div>
        ))}
        {days.map((d) => {
          const key = format(d, 'yyyy-MM-dd');
          const dayEvents = byDay.get(key) || [];
          const inMonth = d.getMonth() === anchor.getMonth();
          const isToday = isSameDay(d, today);
          return (
            <div
              key={key}
              className={`bg-[var(--surface)] min-h-[88px] p-1.5 ${inMonth ? '' : 'opacity-40'}`}
            >
              <div className={`text-xs ${isToday ? 'inline-flex w-6 h-6 items-center justify-center rounded-full bg-[var(--accent)] text-[var(--bg)]' : 'text-[var(--muted)]'}`}>
                {format(d, 'd')}
              </div>
              <div className="mt-1 space-y-0.5">
                {dayEvents.slice(0, 3).map((e) => (
                  <Link key={e.id} href={`/event/${e.id}`} className="block truncate text-[11px] leading-tight rounded px-1 py-0.5 bg-[var(--surface-2)] hover:bg-[var(--border)]">
                    <span className="tabular-nums text-[var(--muted)]">{fmtTime(e.start_time).replace(' ', '')}</span> {e.title}
                  </Link>
                ))}
                {dayEvents.length > 3 && (
                  <div className="text-[10px] text-[var(--muted)]">+{dayEvents.length - 3}개 더보기</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </AppShell>
  );
}
