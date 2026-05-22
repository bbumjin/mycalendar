import Link from 'next/link';
import { Calendar, Home, Plus, Settings, Sparkles } from 'lucide-react';

export function AppShell({
  children,
  active,
  fabHref = '/quick-add',
}: {
  children: React.ReactNode;
  active?: 'today' | 'add' | 'month' | 'settings' | 'briefing';
  fabHref?: string;
}) {
  return (
    <div className="flex flex-col min-h-dvh">
      <header className="sticky top-0 z-20 backdrop-blur bg-[color:var(--bg)]/80 border-b border-[var(--border)]">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/calendar" className="flex items-center gap-2 font-semibold tracking-tight">
            <Sparkles className="w-5 h-5" />
            AI 캘린더
          </Link>

          <div className="flex items-center gap-2">
            {/* 월간 <-> 브리핑 토글 */}
            <div className="flex items-center bg-[var(--surface-2)] border border-[var(--border)] rounded-full p-0.5 text-sm">
              <Toggle href="/calendar" active={active === 'month'}>월간</Toggle>
              <Toggle href="/briefing" active={active === 'briefing'}>브리핑</Toggle>
            </div>
            <Link
              href="/settings"
              aria-label="설정"
              className={`p-2 rounded-full transition ${
                active === 'settings' ? 'bg-[var(--accent)] text-[var(--bg)]' : 'text-[var(--muted)] hover:text-[var(--fg)]'
              }`}
            >
              <Settings className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <div className="max-w-3xl mx-auto w-full px-4 pb-32">{children}</div>
      </main>

      <Link
        href={fabHref}
        aria-label="빠른 추가"
        className="fixed bottom-6 right-6 z-30 w-14 h-14 rounded-full bg-[var(--accent)] text-[var(--bg)] grid place-items-center shadow-xl shadow-black/10 transition-transform active:scale-95"
      >
        <Plus className="w-6 h-6" />
      </Link>
    </div>
  );
}

function Toggle({ href, active, children }: { href: string; active?: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={`px-3 py-1.5 rounded-full transition ${
        active ? 'bg-[var(--accent)] text-[var(--bg)]' : 'text-[var(--muted)] hover:text-[var(--fg)]'
      }`}
    >
      {children}
    </Link>
  );
}

export function PageTitle({ children, sub }: { children: React.ReactNode; sub?: string }) {
  return (
    <div className="pt-6 pb-4">
      <h1 className="text-2xl font-semibold tracking-tight">{children}</h1>
      {sub && <p className="text-[var(--muted)] mt-1 text-sm">{sub}</p>}
    </div>
  );
}

export { Home, Calendar };
