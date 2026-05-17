'use client';

import { useState } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser';

type Initial = {
  display_name: string;
  timezone: string;
  morning_briefing_time: string;
  night_briefing_time: string;
};

const TZ_OPTIONS = [
  ['Asia/Seoul', '서울 (UTC+9)'],
  ['Asia/Tokyo', '도쿄 (UTC+9)'],
  ['Asia/Singapore', '싱가포르 (UTC+8)'],
  ['America/Los_Angeles', '로스앤젤레스 (UTC-8/-7)'],
  ['America/New_York', '뉴욕 (UTC-5/-4)'],
  ['Europe/London', '런던 (UTC+0/+1)'],
  ['Europe/Berlin', '베를린 (UTC+1/+2)'],
] as const;

export function ProfileForm({ initial }: { initial: Initial }) {
  const [state, setState] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    setSaved(false);
    const supabase = getSupabaseBrowserClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setError('로그인이 필요합니다.');
      setSaving(false);
      return;
    }
    const { error } = await supabase
      .from('profiles')
      .update({
        display_name: state.display_name || null,
        timezone: state.timezone,
        morning_briefing_time: state.morning_briefing_time,
        night_briefing_time: state.night_briefing_time,
      })
      .eq('id', user.id);
    if (error) setError(error.message);
    else setSaved(true);
    setSaving(false);
  }

  return (
    <div className="space-y-3">
      <Field label="표시 이름">
        <input
          className="input"
          value={state.display_name}
          onChange={(e) => setState({ ...state, display_name: e.target.value })}
          placeholder="홍길동"
        />
      </Field>
      <Field label="시간대">
        <select
          className="input"
          value={state.timezone}
          onChange={(e) => setState({ ...state, timezone: e.target.value })}
        >
          {TZ_OPTIONS.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
        </select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="아침 브리핑">
          <input type="time" className="input" value={state.morning_briefing_time} onChange={(e) => setState({ ...state, morning_briefing_time: e.target.value })} />
        </Field>
        <Field label="저녁 브리핑">
          <input type="time" className="input" value={state.night_briefing_time} onChange={(e) => setState({ ...state, night_briefing_time: e.target.value })} />
        </Field>
      </div>
      <div className="flex items-center gap-3 pt-1">
        <button onClick={save} disabled={saving} className="btn-primary text-sm">
          {saving ? '저장 중…' : '저장'}
        </button>
        {saved && <span className="text-emerald-600 text-sm">저장되었습니다.</span>}
        {error && <span className="text-rose-600 text-sm">{error}</span>}
      </div>
    </div>
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
