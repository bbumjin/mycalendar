import { AppShell, PageTitle } from '@/components/AppShell';

export default function Loading() {
  return (
    <AppShell>
      <PageTitle>일정 편집</PageTitle>
      <div className="card p-6 space-y-4">
        <div className="h-10 rounded-lg bg-[var(--surface-2)] animate-pulse" />
        <div className="grid grid-cols-2 gap-3">
          <div className="h-10 rounded-lg bg-[var(--surface-2)] animate-pulse" />
          <div className="h-10 rounded-lg bg-[var(--surface-2)] animate-pulse" />
        </div>
        <div className="h-10 rounded-lg bg-[var(--surface-2)] animate-pulse" />
        <div className="h-20 rounded-lg bg-[var(--surface-2)] animate-pulse" />
      </div>
    </AppShell>
  );
}
