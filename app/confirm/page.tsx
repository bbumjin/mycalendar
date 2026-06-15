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

// One editable event row on the confirm screen. attendeesRaw is the raw comma string
// the user types; only valid emails are kept when saving.
type EventForm = {
  title: string;
  startLocal: string;
  endLocal: string;
  location: string;
  attendeesRaw: string;
  reminders: { minutes_before: number }[];
  confidence: number;
  warning?: string;
};

function isEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
}

export default function ConfirmPage() {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [calendarAccountId, setCalendarAccountId] = useState<string>('local');

  const [forms, setForms] = useState<EventForm[]>([]);

  useEffect(() => {
    const d = loadDraft();
    if (!d || d.events.length === 0) {
      router.replace('/quick-add');
      return;
    }
    setDraft(d);
    setForms(
      d.events.map(({ extraction, warning }) => {
        const hasLoc = !!(extraction.location_text && extraction.location_text.trim().length > 0);
        return {
          title: extraction.title,
          startLocal: localInputValue(extraction.start_datetime),
          endLocal: localInputValue(extraction.end_datetime),
          location: extraction.location_text || '',
          attendeesRaw: (extraction.attendees || []).join(', '),
          reminders: hasLoc
            ? [{ minutes_before: 120 }, { minutes_before: 60 }, { minutes_before: 5 }]
            : [{ minutes_before: 60 }, { minutes_before: 5 }],
          confidence: extraction.confidence,
          warning,
        };
      })
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

  function update(index: number, patch: Partial<EventForm>) {
    setForms((prev) => prev.map((f, i) => (i === index ? { ...f, ...patch } : f)));
  }

  // When start changes, shift end by the same delta to preserve duration.
  function changeStart(index: number, v: string) {
    const f = forms[index];
    let endLocal = f.endLocal;
    try {
      const oldStart = Date.parse(inputValueToIso(f.startLocal, DEFAULT_TZ));
      const oldEnd = Date.parse(inputValueToIso(f.endLocal, DEFAULT_TZ));
      const newStart = Date.parse(inputValueToIso(v, DEFAULT_TZ));
      if (!Number.isNaN(oldStart) && !Number.isNaN(oldEnd) && !Number.isNaN(newStart)) {
        const dur = Math.max(0, oldEnd - oldStart);
        endLocal = localInputValue(new Date(newStart + dur).toISOString(), DEFAULT_TZ);
      }
    } catch {
      /* ignore */
    }
    update(index, { startLocal: v, endLocal });
  }

  function removeForm(index: number) {
    setForms((prev) => prev.filter((_, i) => i !== index));
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      for (const f of forms) {
        const attendees = f.attendeesRaw
          .split(',')
          .map((s) => s.trim())
          .filter(isEmail);
        const start_time = inputValueToIso(f.startLocal, DEFAULT_TZ);
        const end_time = inputValueToIso(f.endLocal, DEFAULT_TZ);
        const res = await fetch('/api/events', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: f.title,
            start_time,
            end_time,
            location_text: f.location || null,
            attendees,
            source_type: draft!.source_type,
            ai_confidence: f.confidence,
            reminders: f.reminders,
            calendar_account_id: calendarAccountId === 'local' ? null : calendarAccountId,
          }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || '저장에 실패했습니다.');
      }
      clearDraft();
      router.replace('/calendar');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '저장에 실패했습니다.');
      setSaving(false);
    }
  }

  const multi = forms.length > 1;

  return (
    <AppShell active="add">
      <PageTitle sub={draft.source_type === 'voice' ? '음성에서 추출 — 확인 후 저장' : '확인 후 저장'}>
        {multi ? `일정 확인 (${forms.length}건)` : '일정 확인'}
      </PageTitle>

      <div className="space-y-4">
        {forms.map((f, i) => (
          <div key={i} className="card p-6 space-y-4">
            {multi && (
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-[var(--muted)]">일정 {i + 1}</span>
                <button
                  type="button"
                  onClick={() => removeForm(i)}
                  className="text-xs text-[var(--muted)] hover:text-rose-600"
                >
                  삭제
                </button>
              </div>
            )}

            {(f.warning || f.confidence < 0.6) && (
              <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-900/50 p-3 text-sm text-amber-700 dark:text-amber-300">
                ⚠️ {f.warning || '추출 신뢰도가 낮습니다. 시간과 제목을 다시 확인해주세요.'}
              </div>
            )}

            <Field label="제목">
              <input
                className="input text-lg font-medium"
                value={f.title}
                onChange={(e) => update(i, { title: e.target.value })}
                autoFocus={i === 0}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="시작">
                <input
                  type="datetime-local"
                  className="input"
                  value={f.startLocal}
                  onChange={(e) => changeStart(i, e.target.value)}
                />
              </Field>
              <Field label="종료">
                <input
                  type="datetime-local"
                  className="input"
                  value={f.endLocal}
                  onChange={(e) => update(i, { endLocal: e.target.value })}
                />
              </Field>
            </div>
            <Field label="장소">
              <input
                className="input"
                value={f.location}
                onChange={(e) => update(i, { location: e.target.value })}
                placeholder="선택 사항"
              />
            </Field>
            <Field label="참석자">
              <input
                className="input"
                value={f.attendeesRaw}
                onChange={(e) => update(i, { attendeesRaw: e.target.value })}
                placeholder="이메일만 입력 (쉼표로 구분, 초대장 발송)"
              />
            </Field>

            <div className="border-t border-[var(--border)] pt-4">
              <p className="text-xs text-[var(--muted)] uppercase tracking-wide mb-2">알림</p>
              <ReminderEditor value={f.reminders} onChange={(r) => update(i, { reminders: r })} />
            </div>
          </div>
        ))}

        <div className="card p-6 space-y-4">
          {accounts.length > 0 && (
            <div>
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

          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => router.replace('/quick-add')}
              className="text-sm text-[var(--muted)] hover:underline underline-offset-4"
            >
              취소
            </button>
            <button
              type="button"
              onClick={save}
              disabled={saving || forms.length === 0 || forms.some((f) => !f.title.trim())}
              className="btn-primary inline-flex items-center gap-2"
            >
              <Check className="w-4 h-4" />
              {saving ? '저장 중…' : multi ? `${forms.length}건 저장` : '저장'}
            </button>
          </div>
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
