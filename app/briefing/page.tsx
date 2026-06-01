import Link from 'next/link';
import { AppShell, PageTitle } from '@/components/AppShell';
import { requireUser } from '@/lib/supabase/server';
import { fmtTime, DEFAULT_TZ } from '@/lib/time';
import { MapPin } from 'lucide-react';
import { addDays, endOfDay } from 'date-fns';
import { formatInTimeZone, toZonedTime } from 'date-fns-tz';
import { ko } from 'date-fns/locale';
import type { EventRow } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function BriefingPage() {
  const { supabase, user } = await requireUser();
  if (!user) return null;

  // Render on the server (no client fetch-on-mount round trip / spinner).
  const now = new Date();
  const rangeEnd = endOfDay(addDays(toZonedTime(now, DEFAULT_TZ), 3));
  const { data } = await supabase
    .from('events')
    .select('id, title, start_time, location_text')
    .eq('user_id', user.id)
    .gte('start_time', now.toISOString())
    .lte('start_time', rangeEnd.toISOString())
    .order('start_time', { ascending: true });
  const events = (data as EventRow[] | null) ?? [];

  const groups = new Map<string, EventRow[]>();
  for (const e of events) {
    const key = formatInTimeZone(new Date(e.start_time), DEFAULT_TZ, 'yyyy-MM-dd');
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(e);
  }
  const todayKey = formatInTimeZone(now, DEFAULT_TZ, 'yyyy-MM-dd');

  return (
    <AppShell active="briefing">
      <PageTitle sub="지금부터 3일간의 일정">브리핑</PageTitle>

      {events.length === 0 ? (
        <div className="card p-5 text-[var(--muted)] text-sm">예정된 일정이 없습니다.</div>
      ) : (
        <div className="space-y-5">
          {Array.from(groups.entries()).map(([dateKey, list]) => {
            const date = new Date(dateKey + 'T12:00:00');
            const dayDiff = daysFromTodayKey(todayKey, dateKey);
            const relLabel = dayDiff === 0 ? '오늘' : dayDiff === 1 ? '내일' : dayDiff === 2 ? '모레' : null;
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
