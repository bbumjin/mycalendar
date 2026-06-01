import { AppShell } from '@/components/AppShell';

// Streamed instantly on navigation so the chrome + grid skeleton show before the
// per-request event/holiday queries resolve.
export default function Loading() {
  return (
    <AppShell active="month">
      <div className="pt-6 pb-4 flex items-center gap-2">
        <div className="h-8 w-40 rounded-lg bg-[var(--surface-2)] animate-pulse" />
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
        {Array.from({ length: 42 }).map((_, i) => (
          <div key={i} className="min-h-[92px] p-1.5 bg-[var(--surface)]">
            <div className="h-3 w-4 rounded bg-[var(--surface-2)] animate-pulse" />
          </div>
        ))}
      </div>
    </AppShell>
  );
}
