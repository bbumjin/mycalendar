import Link from 'next/link';
import { Calendar, Home, Plus, Settings, Sparkles } from 'lucide-react';

export function AppShell({
  children,
  active,
}: {
  children: React.ReactNode;
  active?: 'today' | 'add' | 'month' | 'settings' | 'briefing';
}) {
  return (
    <div className="flex flex-col min-h-dvh">
      <header className="sticky top-0 z-20 backdrop-blur bg-[color:var(--bg)]/80 border-b border-[var(--border)]">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
            <Sparkles className="w-5 h-5" />
            AI 캘린더
          </Link>
          <nav className="flex items-center gap-1 text-sm">
            <NavLink href="/" active={active === 'today'}>오늘</NavLink>
            <NavLink href="/calendar" active={active === 'month'}>월간</NavLink>
            <NavLink href="/briefing" active={active === 'briefing'}>브리핑</NavLink>
            <NavLink href="/settings" active={active === 'settings'} aria-label="설정">
              <Settings className="w-4 h-4" />
            </NavLink>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <div className="max-w-3xl mx-auto w-full px-4 pb-32">{children}</div>
      </main>

      <Link
        href="/quick-add"
        aria-label="빠른 추가"
        className="fixed bottom-6 right-6 z-30 w-14 h-14 rounded-full bg-[var(--accent)] text-[var(--bg)] grid place-items-center shadow-xl shadow-black/10 transition-transform active:scale-95"
      >
        <Plus className="w-6 h-6" />
      </Link>
    </div>
  );
}

function NavLink({
  href,
  active,
  children,
  ...rest
}: {
  href: string;
  active?: boolean;
  children: React.ReactNode;
  'aria-label'?: string;
}) {
  return (
    <Link
      href={href}
      className={`px-3 py-1.5 rounded-full transition ${
        active ? 'bg-[var(--accent)] text-[var(--bg)]' : 'text-[var(--muted)] hover:text-[var(--fg)]'
      }`}
      {...rest}
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
