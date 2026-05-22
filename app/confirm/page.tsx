'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell, PageTitle } from '@/components/AppShell';
import { ReminderEditor } from '@/components/ReminderEditor';
import { clearDraft, loadDraft, type Draft } from '@/lib/draft-store';
import { DEFAULT_TZ, inputValueToIso, localInputValue } from '@/lib/time';
import { Check, CalendarRange } from 'lucide-react';

type Account = {
  id: string;
  provider: 'google' | 'microsoft';
  provider_account_email: string;
  selected_calendar_name: string | null;
  is_default: boolean;
};

export default function ConfirmPage() {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [calendarAccountId, setCalendarAccountId] = useState<string>('local');

  const [title, setTitle] = useState('');
  const [startLocal, setStartLocal] = useState('');
  const [endLocal, setEndLocal] = useState('');
  const [location, setLocation] = useState('');
  const [attendees, setAttendees] = useState<string[]>([]);
  const [reminders, setReminders] = useState<{ minutes_before: number }[]>([]);

  useEffect(() => {
    const d = loadDraft();
    if (!d) {
      router.replace('/quick-add');
      return;
    }
    setDraft(d);
    setTitle(d.extraction.title);
    setStartLocal(localInputValue(d.extraction.start_datetime));
    setEndLocal(localInputValue(d.extraction.end_datetime));
    setLocation(d.extraction.location_text || '');
    setAttendees(d.extraction.attendees || []);
    const hasLoc = !!(d.extraction.location_text && d.extraction.location_text.trim().length > 0);
    setReminders(
      hasLoc
        ? [{ minutes_before: 120 }, { minutes_before: 60 }, { minutes_before: 5 }]
        : [{ minutes_before: 60 }, { minutes_before: 5 }]
    );
    (async () => {
      const res = await fetch('/api/calendars');
      if (!res.ok) return;
      const { accounts: list } = (await res.json()) as { accounts: Account[] };
      setAccounts(list);
      const def = list.find((a) => a.is_default) || list[0];
      if (def) setCalendarAccountId(def.id);
    })();
  }, [router]);

  if (!draft) return null;

  // When start changes, shift end by the same delta to preserve duration.
  function changeStart(v: string) {
    try {
      const oldStart = Date.parse(inputValueToIso(startLocal, DEFAULT_TZ));
      const oldEnd = Date.parse(inputValueToIso(endLocal, DEFAULT_TZ));
      const newStart = Date.parse(inputValueToIso(v, DEFAULT_TZ));
      if (!Number.isNaN(oldStart) && !Number.isNaN(oldEnd) && !Number.isNaN(newStart)) {
        const dur = Math.max(0, oldEnd - oldStart);
        setEndLocal(localInputValue(new Date(newStart + dur).toISOString(), DEFAULT_TZ));
      }
    } catch {
      /* ignore */
    }
    setStartLocal(v);
  }

  async function save() {
    setSaving(true);
    setError(null);
    setWarning(null);
    try {
      const start_time = inputValueToIso(startLocal, DEFAULT_TZ);
      const end_time = inputValueToIso(endLocal, DEFAULT_TZ);
      const res = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          start_time,
          end_time,
          location_text: location || null,
          attendees,
          source_text: draft!.source_text,
          source_type: draft!.source_type,
          ai_confidence: draft!.extraction.confidence,
          reminders,
          calendar_account_id: calendarAccountId === 'local' ? null : calendarAccountId,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '저장에 실패했습니다.');
      clearDraft();
      router.replace('/calendar');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '저장에 실패했습니다.');
      setSaving(false);
    }
  }

  return (
    <AppShell active="add">
      <PageTitle sub={draft.source_type === 'voice' ? '음성에서 추출 — 확인 후 저장' : '확인 후 저장'}>
        일정 확인
      </PageTitle>

      <div className="card p-6 space-y-4">
        {(draft.warning ||
          (typeof draft.extraction.confidence === 'number' && draft.extraction.confidence < 0.6)) && (
          <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-900/50 p-3 text-sm text-amber-700 dark:text-amber-300">
            ⚠️ {draft.warning || '추출 신뢰도가 낮습니다. 시간과 제목을 다시 확인해주세요.'}
          </div>
        )}

        <Field label="제목">
          <input className="input text-lg font-medium" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="시작">
            <input type="datetime-local" className="input" value={startLocal} onChange={(e) => changeStart(e.target.value)} />
          </Field>
          <Field label="종료">
            <input type="datetime-local" className="input" value={endLocal} onChange={(e) => setEndLocal(e.target.value)} />
          </Field>
        </div>
        <Field label="장소">
          <input className="input" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="선택 사항" />
        </Field>
        <Field label="참석자">
          <input
            className="input"
            value={attendees.join(', ')}
            onChange={(e) => setAttendees(e.target.value.split(',').map((s) => s.trim()).filter(Boolean))}
            placeholder="쉼표로 구분 (이메일이면 초대장 발송)"
          />
        </Field>

        <div className="border-t border-[var(--border)] pt-4">
          <p className="text-xs text-[var(--muted)] uppercase tracking-wide mb-2">알림</p>
          <ReminderEditor value={reminders} onChange={setReminders} />
        </div>

        {accounts.length > 0 && (
          <div className="border-t border-[var(--border)] pt-4">
            <p className="text-xs text-[var(--muted)] uppercase tracking-wide mb-2 flex items-center gap-1.5">
              <CalendarRange className="w-3 h-3" /> 저장할 캘린더
            </p>
            <select
              value={calendarAccountId}
              onChange={(e) => setCalendarAccountId(e.target.value)}
              className="input text-sm"
            >
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.provider === 'google' ? 'Google' : 'Outlook'} — {a.selected_calendar_name || a.provider_account_email}
                  {a.is_default ? ' (기본)' : ''}
                </option>
              ))}
              <option value="local">앱에만 저장 (동기화 안 함)</option>
            </select>
          </div>
        )}

        {error && <p className="text-rose-600 text-sm">{error}</p>}
        {warning && <p className="text-amber-600 text-sm">⚠️ {warning}</p>}

        <div className="flex items-center justify-end gap-3 pt-2">
          <button type="button" onClick={() => router.replace('/quick-add')} className="text-sm text-[var(--muted)] hover:underline underline-offset-4">
            취소
          </button>
          <button type="button" onClick={save} disabled={saving || !title.trim()} className="btn-primary inline-flex items-center gap-2">
            <Check className="w-4 h-4" />
            {saving ? '저장 중…' : '저장'}
          </button>
        </div>
      </div>
    </AppShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs text-[var(--muted)] uppercase tracking-wide">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
