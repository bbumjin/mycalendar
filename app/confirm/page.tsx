'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell, PageTitle } from '@/components/AppShell';
import { ReminderEditor } from '@/components/ReminderEditor';
import { clearDraft, loadDraft, type Draft } from '@/lib/draft-store';
import { fmtDayMonth, fmtTime, DEFAULT_TZ, localInputValue, inputValueToIso } from '@/lib/time';
import { Check, MapPin, Users, CalendarRange } from 'lucide-react';

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
  const [editing, setEditing] = useState(false);
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
      if (json.sync_warning) setWarning(json.sync_warning);
      clearDraft();
      router.replace(`/event/${json.event.id}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '저장에 실패했습니다.');
      setSaving(false);
    }
  }

  return (
    <AppShell active="add">
      <PageTitle sub={draft.source_type === 'voice' ? '음성에서 추출' : '텍스트에서 추출'}>
        이대로 저장할까요?
      </PageTitle>

      <div className="card p-6 space-y-5">
        {!editing ? (
          <>
            <h2 className="text-2xl font-semibold leading-tight">{title}</h2>
            <div className="text-[var(--muted)]">
              <div>{fmtDayMonth(inputValueToIso(startLocal, DEFAULT_TZ))}</div>
              <div className="text-[var(--fg)] text-lg">
                {fmtTime(inputValueToIso(startLocal, DEFAULT_TZ))}{' '}
                <span className="text-[var(--muted)]">–</span>{' '}
                {fmtTime(inputValueToIso(endLocal, DEFAULT_TZ))}
              </div>
            </div>
            {location && (
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="w-4 h-4 text-[var(--muted)]" /> {location}
              </div>
            )}
            {attendees.length > 0 && (
              <div className="flex items-center gap-2 text-sm">
                <Users className="w-4 h-4 text-[var(--muted)]" /> {attendees.join(', ')}
              </div>
            )}
          </>
        ) : (
          <div className="space-y-3">
            <Field label="제목">
              <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="시작">
                <input type="datetime-local" className="input" value={startLocal} onChange={(e) => setStartLocal(e.target.value)} />
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
                placeholder="쉼표로 구분"
              />
            </Field>
          </div>
        )}

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
            {calendarAccountId !== 'local' && (
              <p className="text-xs text-[var(--muted)] mt-2">
                연결된 캘린더에 저장되어 휴대폰의 캘린더 앱에서도 알림을 받습니다.
              </p>
            )}
          </div>
        )}

        {error && <p className="text-rose-600 text-sm">{error}</p>}
        {warning && <p className="text-amber-600 text-sm">⚠️ {warning}</p>}
        {typeof draft.extraction.confidence === 'number' && draft.extraction.confidence < 0.6 && (
          <p className="text-amber-600 text-xs">추출 신뢰도가 낮습니다. 시간과 제목을 다시 확인해주세요.</p>
        )}

        <div className="flex items-center justify-between pt-2">
          <button type="button" onClick={() => setEditing((v) => !v)} className="text-sm underline-offset-4 hover:underline text-[var(--muted)]">
            {editing ? '편집 완료' : '편집'}
          </button>
          <button type="button" onClick={save} disabled={saving} className="btn-primary inline-flex items-center gap-2">
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
