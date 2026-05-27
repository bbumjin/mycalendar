import Link from 'next/link';
import { AppShell } from '@/components/AppShell';
import { requireUser } from '@/lib/supabase/server';
import { DEFAULT_TZ, fmtTime, fmtMonthYear } from '@/lib/time';
import { getKoreanHolidays } from '@/lib/holidays';
import { addDays, addMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, format } from 'date-fns';
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

  const [{ data }, holidays] = await Promise.all([
    supabase
      .from('events_with_reminders')
      .select('*')
      .eq('user_id', user.id)
      .gte('start_time', gridStart.toISOString())
      .lte('start_time', addDays(gridEnd, 1).toISOString())
      .order('start_time', { ascending: true }),
    getKoreanHolidays(),
  ]);

  const events = (data as EventRow[] | null) ?? [];
  const byDay = new Map<string, EventRow[]>();
  for (const e of events) {
    const key = formatInTimeZone(new Date(e.start_time), tz, 'yyyy-MM-dd');
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key)!.push(e);
  }

  const todayKey = format(today, 'yyyy-MM-dd');
  const prevMonthParam = formatInTimeZone(addMonths(monthStart, -1), tz, 'yyyy-MM');
  const nextMonthParam = formatInTimeZone(addMonths(monthStart, 1), tz, 'yyyy-MM');
  const isCurrentMonth = formatInTimeZone(monthStart, tz, 'yyyy-MM') === formatInTimeZone(today, tz, 'yyyy-MM');

  return (
    <AppShell active="month">
      <div className="pt-6 pb-4 flex items-center gap-2">
        <Link
          href={`/calendar?m=${prevMonthParam}`}
          aria-label="이전 달"
          className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--fg)] transition"
        >
          ‹
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">{fmtMonthYear(anchor)}</h1>
        <Link
          href={`/calendar?m=${nextMonthParam}`}
          aria-label="다음 달"
          className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--fg)] transition"
        >
          ›
        </Link>
        {!isCurrentMonth && (
          <Link
            href="/calendar"
            className="ml-2 inline-flex items-center px-2.5 py-1 rounded-full text-xs text-[var(--muted)] border border-[var(--border)] hover:bg-[var(--surface-2)] hover:text-[var(--fg)] transition"
          >
            오늘
          </Link>
        )}
      </div>

      <div className="grid grid-cols-7 gap-px bg-[var(--border)] rounded-2xl overflow-hidden text-sm">
        {['일', '월', '화', '수', '목', '금', '토'].map((d, i) => (
          <div
            key={i}
            className={`bg-[var(--surface-2)] py-2 text-center text-xs ${
              i === 0 || i === 6 ? 'text-rose-500' : 'text-[var(--muted)]'
            }`}
          >
            {d}
          </div>
        ))}
        {days.map((d) => {
          const key = format(d, 'yyyy-MM-dd');
          const dayEvents = byDay.get(key) || [];
          const inMonth = d.getMonth() === anchor.getMonth();
          const isToday = key === todayKey;
          const dow = d.getDay(); // 0=Sun, 6=Sat
          const isHoliday = holidays.dates.has(key);
          const holidayName = holidays.names.get(key);

          // date number color: today=on accent, weekend/holiday=red
          const numColor = isToday
            ? 'text-[var(--bg)]'
            : isHoliday || dow === 0 || dow === 6
              ? 'text-rose-500'
              : 'text-[var(--fg)]';

          const href = dayEvents.length > 0 ? `/day/${key}` : `/quick-add?date=${key}`;

          return (
            <Link
              key={key}
              href={href}
              className={`min-h-[92px] p-1.5 block transition ${
                isToday ? 'bg-[var(--accent)]' : 'bg-[var(--surface)] hover:bg-[var(--surface-2)]'
              } ${inMonth ? '' : 'opacity-40'}`}
            >
              <div className="flex items-center justify-between">
                <span className={`text-xs font-medium ${numColor}`}>{format(d, 'd')}</span>
              </div>
              {isHoliday && holidayName && (
                <div className={`text-[9px] leading-tight truncate ${isToday ? 'text-[var(--bg)]/80' : 'text-rose-500'}`}>
                  {holidayName}
                </div>
              )}
              <div className="mt-1 space-y-0.5">
                {dayEvents.slice(0, 3).map((e) => {
                  const past = new Date(e.end_time).getTime() < Date.now();
                  return (
                    <div
                      key={e.id}
                      className={`truncate text-[11px] leading-tight rounded px-1 py-0.5 ${
                        isToday ? 'bg-[var(--bg)]/15 text-[var(--bg)]' : 'bg-[var(--surface-2)] text-blue-600 dark:text-blue-400'
                      } ${past ? 'line-through opacity-60' : ''}`}
                    >
                      <span className={isToday ? 'text-[var(--bg)]/70 tabular-nums' : 'text-blue-500/80 dark:text-blue-300/80 tabular-nums'}>
                        {fmtTime(e.start_time)}
                      </span>{' '}
                      {e.title}
                    </div>
                  );
                })}
                {dayEvents.length > 3 && (
                  <div className={`text-[10px] ${isToday ? 'text-[var(--bg)]/70' : 'text-blue-500 dark:text-blue-400'}`}>
                    +{dayEvents.length - 3}
                  </div>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </AppShell>
  );
}
