'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Link2, Trash2, Plus, AlertTriangle, RefreshCw, Shield } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';

type Account = {
  id: string;
  provider: 'google' | 'microsoft';
  provider_account_email: string;
  selected_calendar_name: string | null;
  is_default: boolean;
  token_expires_at?: string | null;
  last_synced_at?: string | null;
  last_sync_error?: string | null;
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
  const router = useRouter();
  const [accounts, setAccounts] = useState<Account[]>(initialAccounts);
  const [busy, setBusy] = useState<string | null>(null);
  const [busyKind, setBusyKind] = useState<'default' | 'sync' | 'disconnect' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function setDefault(id: string) {
    setBusy(id);
    setBusyKind('default');
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
      setBusyKind(null);
    }
  }

  async function syncNow(id: string) {
    setBusy(id);
    setBusyKind('sync');
    setError(null);
    setInfo(null);
    try {
      const res = await fetch(`/api/calendars/${id}/sync`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '동기화에 실패했습니다.');
      setAccounts((list) =>
        list.map((a) =>
          a.id === id ? { ...a, last_synced_at: new Date().toISOString(), last_sync_error: null } : a
        )
      );
      setInfo(`${json.imported}개 일정을 가져왔습니다.${json.deleted ? ` (삭제 ${json.deleted}개)` : ''}`);
      router.refresh();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '오류');
    } finally {
      setBusy(null);
      setBusyKind(null);
    }
  }

  async function disconnect(id: string) {
    if (!confirm('이 캘린더 연결을 해제할까요? 이미 가져온 일정은 그대로 유지됩니다.')) return;
    setBusy(id);
    setBusyKind('disconnect');
    setError(null);
    try {
      const res = await fetch(`/api/calendars/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('연결 해제에 실패했습니다.');
      setAccounts((list) => list.filter((a) => a.id !== id));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '오류');
    } finally {
      setBusy(null);
      setBusyKind(null);
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
              className="p-3 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] space-y-2"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar provider={a.provider} />
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
                    <div className="text-[10px] text-[var(--muted)] mt-0.5">
                      {a.last_synced_at
                        ? `마지막 동기화: ${formatDistanceToNow(new Date(a.last_synced_at), { locale: ko, addSuffix: true })}`
                        : '아직 동기화하지 않음'}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => syncNow(a.id)}
                    disabled={busy === a.id}
                    aria-label="지금 동기화"
                    className="p-1.5 rounded-full hover:bg-[var(--border)] transition disabled:opacity-50"
                    title="지금 동기화"
                  >
                    <RefreshCw className={`w-4 h-4 ${busy === a.id && busyKind === 'sync' ? 'animate-spin' : ''}`} />
                  </button>
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
              </div>
              {a.last_sync_error && (
                <p className="text-[11px] text-rose-600">⚠ {a.last_sync_error}</p>
              )}
            </li>
          ))}
        </ul>
      )}

      {error && <p className="text-sm text-rose-600">{error}</p>}
      {info && <p className="text-sm text-emerald-600">{info}</p>}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
        <ConnectButton label="Google 캘린더 연결" href="/api/auth/google/start" enabled={googleEnabled} />
        <ConnectButton label="Outlook 연결" href="/api/auth/microsoft/start" enabled={microsoftEnabled} />
      </div>

      {googleEnabled && (
        <details className="mt-3 rounded-2xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-900/50 p-3 text-xs">
          <summary className="cursor-pointer inline-flex items-center gap-1.5 font-medium text-amber-700 dark:text-amber-300">
            <Shield className="w-3.5 h-3.5" /> "Google에서 확인되지 않은 앱" 경고가 뜬다면
          </summary>
          <div className="mt-3 space-y-2 text-amber-800 dark:text-amber-200">
            <p>
              Google이 검증하지 않은 OAuth 앱이라 보이는 안내입니다. 개인용으로 사용 중이라면 두 가지 방법이 있습니다.
            </p>
            <p className="font-medium">방법 1 — 본인을 테스트 사용자로 등록 (가장 빠름)</p>
            <ol className="list-decimal list-inside space-y-1 ml-2">
              <li><a className="underline" href="https://console.cloud.google.com/apis/credentials/consent" target="_blank" rel="noreferrer">Google Cloud Console → OAuth 동의 화면</a> 열기</li>
              <li>"테스트 사용자" 섹션 → "사용자 추가" → 본인 Gmail 입력 → 저장</li>
              <li>연결 시 경고가 떠도 "고급" → "(앱이름)(으)로 이동" 클릭</li>
            </ol>
            <p className="font-medium">방법 2 — 앱 게시 (경고 완전 제거)</p>
            <ol className="list-decimal list-inside space-y-1 ml-2">
              <li>OAuth 동의 화면 → "프로덕션으로 게시"</li>
              <li>Calendar API는 민감한 스코프라 Google 검증 절차(2–6주)가 필요</li>
              <li>스크린샷·데모 영상·개인정보처리방침 URL 등을 제출</li>
              <li>검증 완료되면 일반 사용자도 경고 없이 동의 가능</li>
            </ol>
          </div>
        </details>
      )}

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
                  <li><a className="underline" href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noreferrer">Google Cloud Console → 사용자 인증 정보</a></li>
                  <li>OAuth 2.0 클라이언트 ID 만들기 (웹 애플리케이션)</li>
                  <li>승인된 리디렉션 URI: <code className="font-mono">https://mycalendar-nine.vercel.app/api/auth/google/callback</code></li>
                  <li>OAuth 동의 화면 → 스코프 추가: <code className="font-mono">https://www.googleapis.com/auth/calendar.events</code></li>
                  <li>Vercel 환경변수: <code className="font-mono">GOOGLE_CLIENT_ID</code>, <code className="font-mono">GOOGLE_CLIENT_SECRET</code>, <code className="font-mono">GOOGLE_REDIRECT_URI</code></li>
                </ol>
              </div>
            )}
            {!microsoftEnabled && (
              <div>
                <p className="font-medium text-[var(--fg)] mb-1">Microsoft / Outlook</p>
                <ol className="list-decimal list-inside space-y-1">
                  <li><a className="underline" href="https://entra.microsoft.com" target="_blank" rel="noreferrer">Microsoft Entra → 앱 등록</a></li>
                  <li>"새 등록" → 지원되는 계정 유형: "모든 Microsoft 계정 (개인 + 회사)" 선택</li>
                  <li>리디렉션 URI(웹): <code className="font-mono">https://mycalendar-nine.vercel.app/api/auth/microsoft/callback</code></li>
                  <li>인증서 및 비밀 → "새 클라이언트 보안 비밀" 생성</li>
                  <li>API 사용 권한 → Microsoft Graph → 위임됨 권한: <code className="font-mono">Calendars.ReadWrite</code>, <code className="font-mono">offline_access</code>, <code className="font-mono">User.Read</code></li>
                  <li>Vercel 환경변수: <code className="font-mono">MICROSOFT_CLIENT_ID</code>, <code className="font-mono">MICROSOFT_CLIENT_SECRET</code>, <code className="font-mono">MICROSOFT_REDIRECT_URI</code></li>
                </ol>
              </div>
            )}
          </div>
        </details>
      )}
    </div>
  );
}

function Avatar({ provider }: { provider: 'google' | 'microsoft' }) {
  const isGoogle = provider === 'google';
  return (
    <div
      className={`w-9 h-9 rounded-full grid place-items-center text-xs font-bold shrink-0`}
      style={{ backgroundColor: isGoogle ? '#4285F4' : '#0078D4', color: 'white' }}
    >
      {isGoogle ? 'G' : 'O'}
    </div>
  );
}

function ConnectButton({ label, href, enabled }: { label: string; href: string; enabled: boolean }) {
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
      <span className="text-[10px]">관리자 설정 필요 (아래 안내)</span>
    </div>
  );
}
