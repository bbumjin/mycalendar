'use client';
import { useEffect, useState } from 'react';

const OPTIONS: Array<{ value: number; label: string }> = [
  { value: 0.9, label: '작게' },
  { value: 1.0, label: '보통' },
  { value: 1.15, label: '크게' },
  { value: 1.3, label: '아주 크게' },
];

const STORAGE_KEY = 'fontScale';

function apply(scale: number) {
  document.documentElement.style.fontSize = `${Math.round(scale * 16)}px`;
}

export function FontSizeSetting() {
  const [scale, setScale] = useState<number>(1.0);

  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? Number(raw) : NaN;
    if (Number.isFinite(parsed) && parsed > 0) setScale(parsed);
  }, []);

  function choose(next: number) {
    setScale(next);
    localStorage.setItem(STORAGE_KEY, String(next));
    apply(next);
  }

  return (
    <div className="grid grid-cols-4 gap-2">
      {OPTIONS.map((opt) => {
        const active = Math.abs(scale - opt.value) < 0.01;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => choose(opt.value)}
            className={`rounded-2xl py-2.5 text-sm transition border ${
              active
                ? 'bg-[var(--accent)] text-[var(--bg)] border-transparent'
                : 'bg-[var(--surface-2)] text-[var(--fg)] border-[var(--border)] hover:bg-[var(--surface)]'
            }`}
            style={{ fontSize: `${Math.round(opt.value * 14)}px` }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
