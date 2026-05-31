'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AppShell, PageTitle } from '@/components/AppShell';
import { fmtTime, DEFAULT_TZ } from '@/lib/time';
import { MapPin } from 'lucide-react';
import { formatInTimeZone } from 'date-fns-tz';
import { ko } from 'date-fns/locale';
import type { EventRow } from '@/lib/types';

export default function BriefingPage() {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/briefing');
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || '불러오지 못했습니다.');
        setEvents(json.events ?? []);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : '불러오지 못했습니다.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const groups = useMemo(() => {
    const map = new Map<string, EventRow[]>();
    for (const e of events) {
      const key = formatInTimeZone(new Date(e.start_time), DEFAULT_TZ, 'yyyy-MM-dd');
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    }
    return Array.from(map.entries());
  }, [events]);

  const todayKey = formatInTimeZone(new Date(), DEFAULT_TZ, 'yyyy-MM-dd');

  return (
    <AppShell active="briefing">
      <PageTitle sub="지금부터 3일간의 일정">브리핑</PageTitle>

      {loading && <p className="text-[var(--muted)]">불러오는 중…</p>}
      {error && <p className="text-rose-600 text-sm">{error}</p>}

      {!loading && !error && events.length === 0 && (
        <div className="card p-5 text-[var(--muted)] text-sm">예정된 일정이 없습니다.</div>
      )}

      {!loading && groups.length > 0 && (
        <div className="space-y-5">
          {groups.map(([dateKey, list]) => {
            const date = new Date(dateKey + 'T12:00:00');
            const dayDiff = daysFromTodayKey(todayKey, dateKey);
            const relLabel =
              dayDiff === 0 ? '오늘' : dayDiff === 1 ? '내일' : dayDiff === 2 ? '모레' : null;
            return (
              <section key={dateKey}>
                <h2 className="text-xs uppercase tracking-wide text-[var(--muted)] mb-2 flex items-center gap-2">
                  <span>{formatInTimeZone(date, DEFAULT_TZ, 'M월 d일 (EEE)', { locale: ko })}</span>
                  {relLabel && <span className="text-[var(--accent)] normal-case tracking-normal">{relLabel}</span>}
                </h2>
                <div className="space-y-2">
                  {list.map((e) => (
                    <Link key={e.id} href={`/event/${e.id}`} className="card p-3 flex items-center gap-3">
                      <span className="tabular-nums text-sm w-16">{fmtTime(e.start_time)}</span>
                      <span className="flex-1 truncate">{e.title}</span>
                      {e.location_text && <MapPin className="w-3 h-3 text-[var(--muted)]" />}
                    </Link>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}

function daysFromTodayKey(todayKey: string, key: string): number {
  const a = new Date(todayKey + 'T00:00:00Z').getTime();
  const b = new Date(key + 'T00:00:00Z').getTime();
  return Math.round((b - a) / 86400000);
}
