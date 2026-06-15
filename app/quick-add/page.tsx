'use client';

import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AppShell, PageTitle } from '@/components/AppShell';
import { QuickAddInput } from '@/components/QuickAddInput';
import { saveDraft } from '@/lib/draft-store';
import type { Extraction } from '@/lib/types';
import { DEFAULT_TZ } from '@/lib/time';

export default function QuickAddPage() {
  return (
    <Suspense fallback={null}>
      <QuickAddInner />
    </Suspense>
  );
}

function QuickAddInner() {
  const router = useRouter();
  const search = useSearchParams();
  const dateParam = search.get('date'); // YYYY-MM-DD

  // Prefill the textarea with the chosen date so the user just types the rest.
  let prefill = '';
  if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
    const [y, m, d] = dateParam.split('-').map(Number);
    prefill = `${y}년 ${m}월 ${d}일 `;
  }

  async function handleExtract(text: string, source: 'text' | 'voice') {
    const res = await fetch('/api/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text,
        timezone: DEFAULT_TZ,
        now: new Date().toISOString(),
      }),
    });
    const json = await res.json();
    if (!res.ok) {
      throw new Error(json.error || '일정 추출에 실패했습니다.');
    }
    const events = (json.events ?? []) as { event: Extraction; warning?: string }[];
    if (events.length === 0) {
      throw new Error('일정을 찾지 못했습니다. 날짜와 시간을 포함해 다시 입력해주세요.');
    }
    saveDraft({
      events: events.map((e) => ({ extraction: e.event, warning: e.warning })),
      source_text: text,
      source_type: source,
    });
    router.push('/confirm');
  }

  return (
    <AppShell active="add">
      <PageTitle sub="텍스트를 붙여넣거나 입력하거나 말해보세요. 나머지는 AI가 처리합니다.">
        빠른 추가
      </PageTitle>
      <QuickAddInput onExtract={handleExtract} initialText={prefill} />

      {!dateParam && (
        <div className="mt-10 grid gap-3">
          <p className="text-xs uppercase tracking-wide text-[var(--muted)]">예시</p>
          <Example text="다음 주 화요일 오후 3시, 강남역 스타벅스에서 David와 미팅" />
          <Example text="내일 오후 2시에 분당서울대병원 진료 예약" />
          <Example text="6월 25일 10시 제이에스 미팅, 14시 내부 미팅" />
        </div>
      )}
    </AppShell>
  );
}

function Example({ text }: { text: string }) {
  return (
    <div className="card p-3 text-sm text-[var(--muted)] flex items-center justify-between gap-3">
      <span className="line-clamp-1">{text}</span>
      <button
        type="button"
        onClick={() => {
          navigator.clipboard.writeText(text);
        }}
        className="pill !text-[11px]"
      >
        복사
      </button>
    </div>
  );
}
