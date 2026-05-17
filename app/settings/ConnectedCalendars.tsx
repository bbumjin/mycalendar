'use client';

import { useState } from 'react';
import { CheckCircle2, Link2, Trash2, Plus, AlertTriangle } from 'lucide-react';

type Account = {
  id: string;
  provider: 'google' | 'microsoft';
  provider_account_email: string;
  selected_calendar_name: string | null;
  is_default: boolean;
  token_expires_at?: string | null;
};

export function ConnectedCalendars({
  initialAccounts,
  googleEnabled,
  microsoftEnabled,
}: {
  initialAccounts: Account[];
  googleEnabled: boolean;
  microsoftEnabled: boolean;
}) {
  const [accounts, setAccounts] = useState<Account[]>(initialAccounts);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function setDefault(id: string) {
    setBusy(id);
    setError(null);
    try {
      const res = await fetch(`/api/calendars/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_default: true }),
      });
      if (!res.ok) throw new Error('기본 설정에 실패했습니다.');
      setAccounts((list) => list.map((a) => ({ ...a, is_default: a.id === id })));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '오류');
    } finally {
      setBusy(null);
    }
  }

  async function disconnect(id: string) {
    if (!confirm('이 캘린더 연결을 해제할까요? 이미 동기화된 일정은 유지되지만, 앞으로 변경 사항이 동기화되지 않습니다.')) return;
    setBusy(id);
    setError(null);
    try {
      const res = await fetch(`/api/calendars/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('연결 해제에 실패했습니다.');
      setAccounts((list) => list.filter((a) => a.id !== id));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '오류');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-3">
      {accounts.length === 0 ? (
        <div className="rounded-2xl bg-[var(--surface-2)] p-5 text-center text-sm text-[var(--muted)]">
          연결된 캘린더가 없습니다. 아래에서 연결해주세요.
        </div>
      ) : (
        <ul className="space-y-2">
          {accounts.map((a) => (
            <li
              key={a.id}
              className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)]"
            >
              <div className="flex items-center gap-3 min-w-0">
                <ProviderBadge provider={a.provider} />
                <div className="min-w-0">
                  <div className="text-sm font-medium truncate">
                    {a.selected_calendar_name || a.provider_account_email}
                  </div>
                  <div className="text-xs text-[var(--muted)] truncate">
                    {a.provider_account_email}
                    {a.is_default && (
                      <span className="ml-2 inline-flex items-center gap-1 text-emerald-600">
                        <CheckCircle2 className="w-3 h-3" /> 기본
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {!a.is_default && (
                  <button
                    onClick={() => setDefault(a.id)}
                    disabled={busy === a.id}
                    className="pill !text-xs"
                  >
                    기본으로
                  </button>
                )}
                <button
                  onClick={() => disconnect(a.id)}
                  disabled={busy === a.id}
                  aria-label="연결 해제"
                  className="text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 p-1.5 rounded-full transition"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {error && <p className="text-sm text-rose-600">{error}</p>}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
        <ConnectButton
          label="Google 캘린더 연결"
          href="/api/auth/google/start"
          enabled={googleEnabled}
          provider="google"
        />
        <ConnectButton
          label="Outlook 연결"
          href="/api/auth/microsoft/start"
          enabled={microsoftEnabled}
          provider="microsoft"
        />
      </div>

      {(!googleEnabled || !microsoftEnabled) && (
        <details className="mt-3 rounded-2xl bg-[var(--surface-2)] border border-dashed border-[var(--border)] p-4 text-xs text-[var(--muted)]">
          <summary className="cursor-pointer text-[var(--fg)] font-medium inline-flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" /> OAuth 자격증명 설정 안내
          </summary>
          <div className="mt-3 space-y-3">
            {!googleEnabled && (
              <div>
                <p className="font-medium text-[var(--fg)] mb-1">Google</p>
                <ol className="list-decimal list-inside space-y-1">
                  <li><a className="underline" href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noreferrer">Google Cloud Console → 사용자 인증 정보</a> 열기</li>
                  <li>OAuth 2.0 클라이언트 ID 만들기 (웹 애플리케이션)</li>
                  <li>승인된 리디렉션 URI에 <code className="font-mono">{typeof window !== 'undefined' ? window.location.origin : ''}/api/auth/google/callback</code> 추가</li>
                  <li>스코프 추가: <code className="font-mono">https://www.googleapis.com/auth/calendar.events</code></li>
                  <li>발급된 Client ID/Secret을 Vercel 환경변수에 추가: <code className="font-mono">GOOGLE_CLIENT_ID</code>, <code className="font-mono">GOOGLE_CLIENT_SECRET</code>, <code className="font-mono">GOOGLE_REDIRECT_URI</code></li>
                </ol>
              </div>
            )}
            {!microsoftEnabled && (
              <div>
                <p className="font-medium text-[var(--fg)] mb-1">Microsoft / Outlook</p>
                <ol className="list-decimal list-inside space-y-1">
                  <li><a className="underline" href="https://entra.microsoft.com" target="_blank" rel="noreferrer">Microsoft Entra → 앱 등록</a></li>
                  <li>새 앱 등록, 리디렉션 URI에 <code className="font-mono">/api/auth/microsoft/callback</code> 지정</li>
                  <li>API 사용 권한: <code className="font-mono">Calendars.ReadWrite</code>, <code className="font-mono">offline_access</code>, <code className="font-mono">User.Read</code></li>
                  <li>Vercel 환경변수에 <code className="font-mono">MICROSOFT_CLIENT_ID</code>, <code className="font-mono">MICROSOFT_CLIENT_SECRET</code>, <code className="font-mono">MICROSOFT_REDIRECT_URI</code> 추가</li>
                </ol>
              </div>
            )}
          </div>
        </details>
      )}
    </div>
  );
}

function ProviderBadge({ provider }: { provider: 'google' | 'microsoft' }) {
  const isGoogle = provider === 'google';
  return (
    <div className={`w-9 h-9 rounded-full grid place-items-center text-xs font-bold ${isGoogle ? 'bg-[#4285F4] text-white' : 'bg-[#0078D4] text-white'}`}>
      {isGoogle ? 'G' : 'O'}
    </div>
  );
}

function ConnectButton({ label, href, enabled }: { label: string; href: string; enabled: boolean; provider: 'google' | 'microsoft' }) {
  if (enabled) {
    return (
      <a href={href} className="btn-secondary text-center inline-flex items-center justify-center gap-2">
        <Plus className="w-4 h-4" /> {label}
      </a>
    );
  }
  return (
    <div className="rounded-2xl bg-[var(--surface-2)] border border-dashed border-[var(--border)] p-3 text-center text-xs text-[var(--muted)] inline-flex flex-col items-center gap-1">
      <Link2 className="w-4 h-4 opacity-50" />
      {label}
      <span className="text-[10px]">관리자 설정 필요 (아래 안내 참조)</span>
    </div>
  );
}
