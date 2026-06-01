import { AppShell, PageTitle } from '@/components/AppShell';

export default function Loading() {
  return (
    <AppShell active="briefing">
      <PageTitle sub="지금부터 3일간의 일정">브리핑</PageTitle>
      <div className="space-y-5">
        {Array.from({ length: 2 }).map((_, s) => (
          <section key={s}>
            <div className="h-3 w-28 rounded bg-[var(--surface-2)] animate-pulse mb-2" />
            <div className="space-y-2">
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="card p-3 flex items-center gap-3">
                  <div className="h-4 w-14 rounded bg-[var(--surface-2)] animate-pulse" />
                  <div className="h-4 flex-1 rounded bg-[var(--surface-2)] animate-pulse" />
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </AppShell>
  );
}
