'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Rss, Trash2, RefreshCw, Plus } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';

type Subscription = {
  id: string;
  name: string;
  ics_url: string;
  last_synced_at: string | null;
  last_sync_error: string | null;
};

export function IcsSubscriptions() {
  const router = useRouter();
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [url, setUrl] = useState('');
  const [name, setName] = useState('');
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  async function load() {
    const res = await fetch('/api/subscriptions');
    if (res.ok) {
      const json = await res.json();
      setSubs(json.subscriptions);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function add() {
    if (!url.trim()) return;
    setAdding(true);
    setMsg(null);
    try {
      const res = await fetch('/api/subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ics_url: url.trim(), name: name.trim() || undefined }),
      });
      const json = await res.json();
      if (json.error) {
        setMsg({ kind: 'err', text: json.error });
      } else {
        setMsg({ kind: 'ok', text: `${json.imported ?? 0}개 일정을 가져왔습니다.` });
        setUrl('');
        setName('');
        router.refresh();
      }
      await load();
    } catch {
      setMsg({ kind: 'err', text: '추가에 실패했습니다.' });
    } finally {
      setAdding(false);
    }
  }

  async function sync(id: string) {
    setBusy(id);
    setMsg(null);
    try {
      const res = await fetch(`/api/subscriptions/${id}/sync`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setMsg({ kind: 'ok', text: `${json.imported}개 동기화 (삭제 ${json.removed}개)` });
      router.refresh();
      await load();
    } catch (e: unknown) {
      setMsg({ kind: 'err', text: e instanceof Error ? e.message : '동기화 실패' });
    } finally {
      setBusy(null);
    }
  }

  async function remove(id: string) {
    if (!confirm('이 구독을 삭제할까요? 가져온 일정도 함께 제거됩니다.')) return;
    setBusy(id);
    try {
      const res = await fetch(`/api/subscriptions/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setSubs((s) => s.filter((x) => x.id !== id));
        router.refresh();
      }
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-[var(--muted)]">
        Outlook·iCloud·Google 등 어떤 캘린더든 <b>ICS 게시 링크</b>를 붙여넣으면 그 일정이 MyCalendar로 들어옵니다.
        OAuth·관리자 동의가 필요 없어요. (회사 Outlook은 웹 → 설정 → 캘린더 → 공유 캘린더 → "캘린더 게시"에서 ICS 링크를 받으세요.)
      </p>

      {!loading && subs.length > 0 && (
        <ul className="space-y-2">
          {subs.map((s) => (
            <li key={s.id} className="p-3 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] space-y-1">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <Rss className="w-4 h-4 text-[var(--muted)] shrink-0" />
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{s.name}</div>
                    <div className="text-[10px] text-[var(--muted)] truncate">{s.ics_url}</div>
                    <div className="text-[10px] text-[var(--muted)]">
                      {s.last_synced_at
                        ? `마지막 동기화: ${formatDistanceToNow(new Date(s.last_synced_at), { locale: ko, addSuffix: true })}`
                        : '아직 동기화 안 됨'}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => sync(s.id)} disabled={busy === s.id} aria-label="동기화"
                    className="p-1.5 rounded-full hover:bg-[var(--border)] transition disabled:opacity-50">
                    <RefreshCw className={`w-4 h-4 ${busy === s.id ? 'animate-spin' : ''}`} />
                  </button>
                  <button onClick={() => remove(s.id)} disabled={busy === s.id} aria-label="삭제"
                    className="text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 p-1.5 rounded-full transition">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              {s.last_sync_error && <p className="text-[11px] text-rose-600">⚠ {s.last_sync_error}</p>}
            </li>
          ))}
        </ul>
      )}

      <div className="space-y-2">
        <input
          className="input text-sm"
          placeholder="이름 (선택) — 예: 회사 Outlook"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <div className="flex items-center gap-2">
          <input
            className="input text-sm font-mono"
            placeholder="https://outlook.office365.com/owa/calendar/.../reachcalendar.ics"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
          <button onClick={add} disabled={adding || !url.trim()} className="btn-primary text-sm shrink-0 inline-flex items-center gap-1.5">
            <Plus className="w-4 h-4" />
            {adding ? '추가 중…' : '추가'}
          </button>
        </div>
      </div>

      {msg && (
        <p className={`text-sm ${msg.kind === 'ok' ? 'text-emerald-600' : 'text-rose-600'}`}>
          {msg.kind === 'ok' ? '✓' : '⚠'} {msg.text}
        </p>
      )}
    </div>
  );
}
