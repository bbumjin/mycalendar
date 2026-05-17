'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell, PageTitle } from '@/components/AppShell';
import { AddToCalendarButton } from '@/components/AddToCalendarButton';
import { ReminderEditor } from '@/components/ReminderEditor';
import { fmtTime, fmtDayMonth, DEFAULT_TZ, localInputValue, inputValueToIso } from '@/lib/time';
import type { EventRow } from '@/lib/types';
import { Trash2, MapPin, Users, Save, CheckCircle2 } from 'lucide-react';

export default function EventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [event, setEvent] = useState<EventRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  const [title, setTitle] = useState('');
  const [startLocal, setStartLocal] = useState('');
  const [endLocal, setEndLocal] = useState('');
  const [location, setLocation] = useState('');
  const [attendees, setAttendees] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [reminders, setReminders] = useState<{ minutes_before: number }[]>([]);

  useEffect(() => {
    (async () => {
      const res = await fetch(`/api/events/${id}`);
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || '불러오지 못했습니다.');
        return;
      }
      const e: EventRow = json.event;
      setEvent(e);
      setTitle(e.title);
      setStartLocal(localInputValue(e.start_time));
      setEndLocal(localInputValue(e.end_time));
      setLocation(e.location_text || '');
      setAttendees(e.attendees || []);
      setNotes(e.notes || '');
      setReminders((e.reminders || []).map((r) => ({ minutes_before: r.minutes_before })));
    })();
  }, [id]);

  async function save() {
    if (!event) return;
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
          location_text: location || null,
          attendees,
          notes: notes || null,
          reminders,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '저장에 실패했습니다.');
      if (json.sync_warning) setWarning(json.sync_warning);
      setEvent(json.event);
      setEditing(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '저장에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  }

  async function del() {
    if (!event) return;
    if (!confirm('이 일정을 삭제할까요?')) return;
    setBusy(true);
    const res = await fetch(`/api/events/${event.id}`, { method: 'DELETE' });
    if (res.ok) router.replace('/');
    else setBusy(false);
  }

  if (!event) {
    return (
      <AppShell>
        <PageTitle>일정</PageTitle>
        {error ? <p className="text-rose-600 text-sm">{error}</p> : <p className="text-[var(--muted)]">불러오는 중…</p>}
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageTitle>일정</PageTitle>
      <div className="card p-6 space-y-5">
        {!editing ? (
          <>
            <h2 className="text-2xl font-semibold leading-tight">{title}</h2>
            <div className="text-[var(--muted)]">
              <div>{fmtDayMonth(event.start_time)}</div>
              <div className="text-[var(--fg)] text-lg">
                {fmtTime(event.start_time)} <span className="text-[var(--muted)]">–</span> {fmtTime(event.end_time)}
              </div>
            </div>
            {location && <div className="flex items-center gap-2 text-sm"><MapPin className="w-4 h-4 text-[var(--muted)]" /> {location}</div>}
            {attendees.length > 0 && <div className="flex items-center gap-2 text-sm"><Users className="w-4 h-4 text-[var(--muted)]" /> {attendees.join(', ')}</div>}
            {notes && <p className="text-sm whitespace-pre-wrap text-[var(--muted)]">{notes}</p>}
            {event.status === 'synced' && (
              <p className="text-xs text-emerald-600 inline-flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Google 캘린더에 동기화됨
              </p>
            )}
            {event.status === 'failed' && (
              <p className="text-xs text-amber-600">⚠️ Google 캘린더 동기화에 실패했습니다.</p>
            )}
          </>
        ) : (
          <div className="space-y-3">
            <Field label="제목"><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="시작"><input type="datetime-local" className="input" value={startLocal} onChange={(e) => setStartLocal(e.target.value)} /></Field>
              <Field label="종료"><input type="datetime-local" className="input" value={endLocal} onChange={(e) => setEndLocal(e.target.value)} /></Field>
            </div>
            <Field label="장소"><input className="input" value={location} onChange={(e) => setLocation(e.target.value)} /></Field>
            <Field label="참석자">
              <input
                className="input"
                value={attendees.join(', ')}
                onChange={(e) => setAttendees(e.target.value.split(',').map((s) => s.trim()).filter(Boolean))}
              />
            </Field>
            <Field label="메모"><textarea className="input min-h-[80px]" value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
          </div>
        )}

        <div className="border-t border-[var(--border)] pt-4">
          <p className="text-xs text-[var(--muted)] uppercase tracking-wide mb-2">알림</p>
          <ReminderEditor value={reminders} onChange={setReminders} />
        </div>

        <div className="border-t border-[var(--border)] pt-4 flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="text-xs text-[var(--muted)] uppercase tracking-wide mb-1">캘린더 앱으로 보내기</p>
            <p className="text-xs text-[var(--muted)]">.ics 파일을 받아 폰의 캘린더에 알림과 함께 추가됩니다.</p>
          </div>
          <AddToCalendarButton eventId={event.id} />
        </div>

        {event.source_text && (
          <details className="text-xs text-[var(--muted)]">
            <summary className="cursor-pointer">원본 입력 보기</summary>
            <pre className="mt-2 p-3 bg-[var(--surface-2)] rounded-lg whitespace-pre-wrap">{event.source_text}</pre>
          </details>
        )}

        {error && <p className="text-rose-600 text-sm">{error}</p>}
        {warning && <p className="text-amber-600 text-sm">⚠️ {warning}</p>}

        <div className="flex items-center justify-between pt-2">
          <button type="button" onClick={del} disabled={busy} className="text-sm text-rose-600 hover:underline inline-flex items-center gap-1">
            <Trash2 className="w-4 h-4" /> 삭제
          </button>
          {editing ? (
            <button type="button" onClick={save} disabled={busy} className="btn-primary inline-flex items-center gap-2">
              <Save className="w-4 h-4" /> {busy ? '저장 중…' : '저장'}
            </button>
          ) : (
            <button type="button" onClick={() => setEditing(true)} className="btn-secondary">편집</button>
          )}
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
