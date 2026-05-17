'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AppShell, PageTitle } from '@/components/AppShell';
import { fmtTime, fmtDateLong } from '@/lib/time';
import { Sunrise, Moon, MapPin } from 'lucide-react';
import type { EventRow } from '@/lib/types';

type Payload = {
  kind: 'morning' | 'night';
  target_date: string;
  events: EventRow[];
  first_event: EventRow | null;
  located_events: EventRow[];
};

export default function BriefingPage() {
  const [data, setData] = useState<Payload | null>(null);
  const [kind, setKind] = useState<'morning' | 'night'>('morning');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load(k: 'morning' | 'night') {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/briefing?kind=${k}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '불러오지 못했습니다.');
      setData(json.payload);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const h = new Date().getHours();
    const k: 'morning' | 'night' = h < 14 ? 'morning' : 'night';
    setKind(k);
    load(k);
  }, []);

  return (
    <AppShell active="briefing">
      <PageTitle sub={data ? fmtDateLong(new Date(data.target_date + 'T12:00:00')) : ''}>
        {kind === 'morning' ? '아침 브리핑' : '오늘 밤 · 내일'}
      </PageTitle>

      <div className="flex gap-2 mb-4">
        <button
          onClick={() => { setKind('morning'); load('morning'); }}
          className={`pill !text-xs inline-flex items-center gap-1 ${kind === 'morning' ? 'bg-[var(--accent)] !text-[var(--bg)]' : ''}`}
        >
          <Sunrise className="w-3 h-3" /> 아침
        </button>
        <button
          onClick={() => { setKind('night'); load('night'); }}
          className={`pill !text-xs inline-flex items-center gap-1 ${kind === 'night' ? 'bg-[var(--accent)] !text-[var(--bg)]' : ''}`}
        >
          <Moon className="w-3 h-3" /> 저녁
        </button>
      </div>

      {loading && <p className="text-[var(--muted)]">불러오는 중…</p>}
      {error && <p className="text-rose-600 text-sm">{error}</p>}

      {data && !loading && (
        <div className="space-y-4">
          {data.first_event ? (
            <div className="card p-5">
              <p className="text-xs uppercase tracking-wide text-[var(--muted)]">첫 일정</p>
              <div className="mt-1 text-xl font-semibold">{data.first_event.title}</div>
              <div className="text-[var(--muted)] text-sm">{fmtTime(data.first_event.start_time)}</div>
              {data.first_event.location_text && (
                <div className="mt-1 inline-flex items-center gap-1 text-sm">
                  <MapPin className="w-4 h-4 text-[var(--muted)]" /> {data.first_event.location_text}
                </div>
              )}
            </div>
          ) : (
            <div className="card p-5 text-[var(--muted)] text-sm">예정된 일정이 없습니다.</div>
          )}

          {data.events.length > 0 && (
            <div>
              <p className="text-xs uppercase tracking-wide text-[var(--muted)] mb-2">전체 일정</p>
              <div className="space-y-2">
                {data.events.map((e) => (
                  <Link key={e.id} href={`/event/${e.id}`} className="card p-3 flex items-center gap-3">
                    <span className="tabular-nums text-sm w-16">{fmtTime(e.start_time)}</span>
                    <span className="flex-1 truncate">{e.title}</span>
                    {e.location_text && <MapPin className="w-3 h-3 text-[var(--muted)]" />}
                  </Link>
                ))}
              </div>
            </div>
          )}

          {data.located_events.length > 0 && kind === 'night' && (
            <p className="text-xs text-[var(--muted)] mt-2">
              내일 장소가 있는 일정 {data.located_events.length}개 — 이동 시간을 미리 확인해두세요.
            </p>
          )}
        </div>
      )}
    </AppShell>
  );
}
