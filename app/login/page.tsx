'use client';

import { useState, Suspense, type FormEvent } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';
import { Sparkles } from 'lucide-react';

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginShell><div className="h-44" /></LoginShell>}>
      <LoginInner />
    </Suspense>
  );
}

function LoginInner() {
  const router = useRouter();
  const search = useSearchParams();
  const next = search.get('next') || '/';
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ kind: 'idle' | 'sent' | 'error'; msg?: string }>({ kind: 'idle' });

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!email) return;
    setBusy(true);
    setStatus({ kind: 'idle' });
    const supabase = getSupabaseBrowserClient();
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo },
    });
    setBusy(false);
    if (error) setStatus({ kind: 'error', msg: error.message });
    else setStatus({ kind: 'sent' });
  }

  async function devLoginSkip() {
    const supabase = getSupabaseBrowserClient();
    setBusy(true);
    const { error } = await supabase.auth.signInAnonymously();
    setBusy(false);
    if (error) {
      setStatus({
        kind: 'error',
        msg: error.message + ' (Supabase 인증 설정에서 익명 로그인을 켜야 합니다)',
      });
    } else {
      router.push(next);
    }
  }

  return (
    <LoginShell>
      <form onSubmit={submit} className="space-y-4">
        <label className="block text-sm text-[var(--muted)]">
          이메일
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 input"
            placeholder="you@example.com"
          />
        </label>
        <button
          type="submit"
          disabled={busy}
          className="w-full btn-primary"
        >
          {busy ? '전송 중…' : '매직 링크 보내기'}
        </button>
        {status.kind === 'sent' && (
          <p className="text-sm text-emerald-600">이메일을 확인해 로그인 링크를 눌러주세요.</p>
        )}
        {status.kind === 'error' && (
          <p className="text-sm text-rose-600">{status.msg}</p>
        )}
      </form>
      <button
        type="button"
        onClick={devLoginSkip}
        className="mt-6 w-full text-xs text-[var(--muted)] underline-offset-4 hover:underline"
      >
        익명으로 시작하기
      </button>
    </LoginShell>
  );
}

function LoginShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-dvh flex items-center justify-center px-6 bg-[var(--bg)]">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2 mb-8 justify-center">
          <Sparkles className="w-6 h-6" />
          <h1 className="text-xl font-semibold tracking-tight">AI 캘린더</h1>
        </div>
        {children}
      </div>
    </main>
  );
}
