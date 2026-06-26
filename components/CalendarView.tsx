'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import Link from 'next/link';
import { DEFAULT_TZ, fmtTime, fmtMonthYear } from '@/lib/time';
import { addMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, format } from 'date-fns';
import { toZonedTime, formatInTimeZone } from 'date-fns-tz';
import type { MonthGrid, GridEvent } from '@/lib/calendar-data';

function anchorOf(monthKey: string): Date {
  return toZonedTime(new Date(`${monthKey}-01T00:00:00+09:00`), DEFAULT_TZ);
}
function shiftMonth(monthKey: string, delta: number): string {
  return formatInTimeZone(addMonths(anchorOf(monthKey), delta), DEFAULT_TZ, 'yyyy-MM');
}

export function CalendarView({ initialMonth, initialData }: { initialMonth: string; initialData: MonthGrid }) {
  const [month, setMonth] = useState(initialMonth);
  const [cache, setCache] = useState<Record<string, MonthGrid>>({ [initialMonth]: initialData });
  const inflight = useRef<Set<string>>(new Set());

  const ensureMonth = useCallback(
    async (key: string) => {
      if (cache[key] || inflight.current.has(key)) return;
      inflight.current.add(key);
      try {
        const res = await fetch(`/api/calendar/month?m=${key}`);
        if (res.ok) {
          const grid = (await res.json()) as MonthGrid;
          setCache((c) => ({ ...c, [key]: grid }));
        }
      } finally {
        inflight.current.delete(key);
      }
    },
    [cache],
  );

  // Load the shown month if needed and prefetch its neighbours so < > is instant.
  useEffect(() => {
    ensureMonth(month);
    ensureMonth(shiftMonth(month, -1));
    ensureMonth(shiftMonth(month, 1));
  }, [month, ensureMonth]);

  const data = cache[month];
  const anchor = useMemo(() => anchorOf(month), [month]);
  const days = useMemo(() => {
    const gridStart = startOfWeek(startOfMonth(anchor));
    const gridEnd = endOfWeek(endOfMonth(anchor));
    return eachDayOfInterval({ start: gridStart, end: gridEnd });
  }, [anchor]);

  const byDay = useMemo(() => {
    const map = new Map<string, GridEvent[]>();
    for (const e of data?.events ?? []) {
      const key = formatInTimeZone(new Date(e.start_time), DEFAULT_TZ, 'yyyy-MM-dd');
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    }
    return map;
  }, [data]);

  const holidays = data?.holidays ?? {};
  const todayKey = formatInTimeZone(new Date(), DEFAULT_TZ, 'yyyy-MM-dd');
  const currentMonthKey = formatInTimeZone(new Date(), DEFAULT_TZ, 'yyyy-MM');

  const chevron =
    'inline-flex h-9 w-9 items-center justify-center rounded-full text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--fg)] transition';

  return (
    <>
      <div className="pt-6 pb-4 flex items-center gap-2">
        <button onClick={() => setMonth(shiftMonth(month, -1))} aria-label="이전 달" className={chevron}>‹</button>
        <h1 className="text-2xl font-semibold tracking-tight">{fmtMonthYear(anchor)}</h1>
        <button onClick={() => setMonth(shiftMonth(month, 1))} aria-label="다음 달" className={chevron}>›</button>
        {month !== currentMonthKey && (
          <button
            onClick={() => setMonth(currentMonthKey)}
            className="ml-2 inline-flex items-center px-2.5 py-1 rounded-full text-xs text-[var(--muted)] border border-[var(--border)] hover:bg-[var(--surface-2)] hover:text-[var(--fg)] transition"
          >
            오늘
          </button>
        )}
        {!data && <span className="ml-1 text-xs text-[var(--muted)]">불러오는 중…</span>}
      </div>

      <div className="grid grid-cols-7 gap-px bg-[var(--border)] rounded-2xl overflow-hidden text-sm">
        {['일', '월', '화', '수', '목', '금', '토'].map((d, i) => (
          <div
            key={i}
            className={`bg-[var(--surface-2)] py-2 text-center text-xs ${i === 0 || i === 6 ? 'text-rose-500' : 'text-[var(--muted)]'}`}
          >
            {d}
          </div>
        ))}
        {days.map((d) => {
          const key = format(d, 'yyyy-MM-dd');
          const dayEvents = byDay.get(key) || [];
          const inMonth = d.getMonth() === anchor.getMonth();
          const isToday = key === todayKey;
          const dow = d.getDay();
          const isHoliday = key in holidays;
          const holidayName = holidays[key];

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
                        {e.all_day ? '종일' : fmtTime(e.start_time)}
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
    </>
  );
}
