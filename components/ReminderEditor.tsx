'use client';

import { Bell, X } from 'lucide-react';

const SUGGESTED = [5, 15, 30, 60, 120, 1440];

export function ReminderEditor({
  value,
  onChange,
}: {
  value: { minutes_before: number }[];
  onChange: (next: { minutes_before: number }[]) => void;
}) {
  const set = new Set(value.map((v) => v.minutes_before));

  function toggle(min: number) {
    if (set.has(min)) {
      onChange(value.filter((v) => v.minutes_before !== min));
    } else {
      onChange([...value, { minutes_before: min }].sort((a, b) => b.minutes_before - a.minutes_before));
    }
  }

  return (
    <div className="flex flex-wrap gap-2 items-center">
      <Bell className="w-4 h-4 text-[var(--muted)]" />
      {value.length === 0 && <span className="text-sm text-[var(--muted)]">알림 없음</span>}
      {value.map((r) => (
        <button
          key={r.minutes_before}
          type="button"
          onClick={() => toggle(r.minutes_before)}
          className="pill flex items-center gap-1 !text-xs !text-[var(--fg)] bg-[var(--surface-2)]"
        >
          {labelFor(r.minutes_before)} 전
          <X className="w-3 h-3" />
        </button>
      ))}
      <div className="w-px h-4 bg-[var(--border)] mx-1" />
      {SUGGESTED.filter((m) => !set.has(m)).map((m) => (
        <button
          key={m}
          type="button"
          onClick={() => toggle(m)}
          className="pill !text-xs"
        >
          +{labelFor(m)} 전
        </button>
      ))}
    </div>
  );
}

function labelFor(min: number) {
  if (min < 60) return `${min}분`;
  if (min < 1440) return `${Math.round(min / 60)}시간`;
  return `${Math.round(min / 1440)}일`;
}
