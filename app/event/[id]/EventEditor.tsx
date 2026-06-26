'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell, PageTitle } from '@/components/AppShell';
import { ReminderEditor } from '@/components/ReminderEditor';
import { DEFAULT_TZ, localInputValue, inputValueToIso } from '@/lib/time';
import type { EventRow } from '@/lib/types';
import { Trash2, Save, CheckCircle2 } from 'lucide-react';

export function EventEditor({ event }: { event: EventRow }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  // Initialized from server-fetched data — no client fetch-on-mount.
  const [title, setTitle] = useState(event.title);
  const [allDay, setAllDayState] = useState(!!event.all_day);
  const [startLocal, setStartLocal] = useState(localInputValue(event.start_time));
  const [endLocal, setEndLocal] = useState(localInputValue(event.end_time));
  const [location, setLocation] = useState(event.location_text || '');
  const [attendees, setAttendees] = useState<string[]>(event.attendees || []);
  const [notes, setNotes] = useState(event.notes || '');
  const [reminders, setReminders] = useState<{ minutes_before: number }[]>(
    (event.reminders || []).map((r) => ({ minutes_before: r.minutes_before })),
  );

  function setAllDay(on: boolean) {
    const sd = startLocal.slice(0, 10);
    if (on) {
      const ed = endLocal.slice(0, 10);
      const endDate = ed < sd ? sd : ed;
      setStartLocal(`${sd}T00:00`);
      setEndLocal(`${endDate}T23:59`);
    } else {
      setStartLocal(`${sd}T09:00`);
      setEndLocal(`${sd}T10:00`);
    }
    setAllDayState(on);
  }

  function changeAllDayDate(which: 'start' | 'end', date: string) {
    if (!date) return;
    if (which === 'start') {
      const ed = endLocal.slice(0, 10);
      const endDate = ed < date ? date : ed;
      setStartLocal(`${date}T00:00`);
      setEndLocal(`${endDate}T23:59`);
    } else {
      setEndLocal(`${date}T23:59`);
    }
  }

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
    setBusy(true);
    setError(null);
    setWarning(null);
    try {
      const res = await fetch(`/api/events/${event.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          start_time: inputValueToIso(startLocal, DEFAULT_TZ),
          end_time: inputValueToIso(endLocal, DEFAULT_TZ),
          all_day: allDay,
          location_text: location || null,
          attendees,
          notes: notes || null,
          reminders,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '저장에 실패했습니다.');
      // 저장되면 월간 캘린더로 복귀
      router.replace('/calendar');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '저장에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  }

  async function del() {
    if (!confirm('이 일정을 삭제할까요?')) return;
    setBusy(true);
    const res = await fetch(`/api/events/${event.id}`, { method: 'DELETE' });
    if (res.ok) router.back();
    else setBusy(false);
  }

  return (
    <AppShell>
      <PageTitle sub={event.source_provider === 'google' ? 'Google 캘린더' : event.source_provider === 'microsoft' ? 'Outlook' : event.source_provider === 'ics' ? '구독 캘린더' : undefined}>
        일정 편집
      </PageTitle>

      <div className="card p-6 space-y-4">
        <Field label="제목">
          <input className="input text-lg font-medium" value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
          <input
            type="checkbox"
            className="h-4 w-4 accent-[var(--accent)]"
            checked={allDay}
            onChange={(e) => setAllDay(e.target.checked)}
          />
          종일 (하루 종일)
        </label>
        {allDay ? (
          <div className="grid grid-cols-2 gap-3">
            <Field label="시작일">
              <input type="date" className="input" value={startLocal.slice(0, 10)} onChange={(e) => changeAllDayDate('start', e.target.value)} />
            </Field>
            <Field label="종료일">
              <input type="date" className="input" value={endLocal.slice(0, 10)} min={startLocal.slice(0, 10)} onChange={(e) => changeAllDayDate('end', e.target.value)} />
            </Field>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <Field label="시작">
              <input type="datetime-local" className="input" value={startLocal} onChange={(e) => changeStart(e.target.value)} />
            </Field>
            <Field label="종료">
              <input type="datetime-local" className="input" value={endLocal} onChange={(e) => setEndLocal(e.target.value)} />
            </Field>
          </div>
        )}
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
        <Field label="메모">
          <textarea className="input min-h-[80px]" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>

        <div className="border-t border-[var(--border)] pt-4">
          <p className="text-xs text-[var(--muted)] uppercase tracking-wide mb-2">알림</p>
          <ReminderEditor value={reminders} onChange={setReminders} />
        </div>

        {event.status === 'synced' && (
          <p className="text-xs text-emerald-600 inline-flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> 연결된 캘린더에 동기화됨
          </p>
        )}
        {event.status === 'failed' && (
          <p className="text-xs text-amber-600">⚠️ 캘린더 동기화에 실패했습니다.</p>
        )}

        {error && <p className="text-rose-600 text-sm">{error}</p>}
        {warning && <p className="text-amber-600 text-sm">⚠️ {warning}</p>}

        <div className="flex items-center justify-between pt-2">
          <button type="button" onClick={del} disabled={busy} className="text-sm text-rose-600 hover:underline inline-flex items-center gap-1">
            <Trash2 className="w-4 h-4" /> 삭제
          </button>
          <div className="flex items-center gap-3">
            <button type="button" onClick={save} disabled={busy || !title.trim()} className="btn-primary inline-flex items-center gap-2">
              <Save className="w-4 h-4" /> {busy ? '저장 중…' : '저장'}
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
