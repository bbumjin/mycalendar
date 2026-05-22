'use client';

import { Bell } from 'lucide-react';

const OPTIONS = [5, 15, 30, 60, 120, 1440]; // 5m, 15m, 30m, 1h, 2h, 1d

export function ReminderEditor({
  value,
  onChange,
}: {
  value: { minutes_before: number }[];
  onChange: (next: { minutes_before: number }[]) => void;
}) {
  const selected = new Set(value.map((v) => v.minutes_before));
  // show preset options + any custom values already chosen
  const all = Array.from(new Set([...OPTIONS, ...value.map((v) => v.minutes_before)])).sort((a, b) => a - b);

  function toggle(min: number) {
    if (selected.has(min)) {
      onChange(value.filter((v) => v.minutes_before !== min));
    } else {
      onChange([...value, { minutes_before: min }].sort((a, b) => b.minutes_before - a.minutes_before));
    }
  }

  return (
    <div className="flex flex-wrap gap-2 items-center">
      <Bell className="w-4 h-4 text-[var(--muted)] shrink-0" />
      {all.map((m) => {
        const on = selected.has(m);
        return (
          <button
            key={m}
            type="button"
            onClick={() => toggle(m)}
            aria-pressed={on}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${
              on
                ? 'bg-[var(--accent)] text-[var(--bg)] border-[var(--accent)]'
                : 'bg-[var(--surface-2)] text-[var(--muted)] border-[var(--border)]'
            }`}
          >
            {labelFor(m)} 전
          </button>
        );
      })}
    </div>
  );
}

function labelFor(min: number) {
  if (min < 60) return `${min}분`;
  if (min < 1440) return `${Math.round(min / 60)}시간`;
  return `${Math.round(min / 1440)}일`;
}
