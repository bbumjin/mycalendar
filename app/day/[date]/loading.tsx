import { AppShell } from '@/components/AppShell';

export default function Loading() {
  return (
    <AppShell active="month">
      <div className="pt-6 pb-4 flex items-center gap-3">
        <div className="h-8 w-48 rounded-lg bg-[var(--surface-2)] animate-pulse" />
      </div>
      <div className="space-y-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="card p-4 flex items-start gap-4">
            <div className="w-20 shrink-0 space-y-1">
              <div className="h-4 w-14 rounded bg-[var(--surface-2)] animate-pulse" />
              <div className="h-3 w-10 rounded bg-[var(--surface-2)] animate-pulse" />
            </div>
            <div className="flex-1 space-y-2">
              <div className="h-4 w-2/3 rounded bg-[var(--surface-2)] animate-pulse" />
              <div className="h-3 w-1/3 rounded bg-[var(--surface-2)] animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </AppShell>
  );
}
