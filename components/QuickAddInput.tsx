'use client';

import { useRef, useState } from 'react';
import { Mic, Square, Sparkles } from 'lucide-react';

type Props = {
  onExtract: (text: string, source: 'text' | 'voice') => void | Promise<void>;
};

export function QuickAddInput({ onExtract }: Props) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState<null | 'extract' | 'transcribe' | 'record'>(null);
  const [error, setError] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  async function startRecording() {
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('이 브라우저에서는 마이크를 사용할 수 없습니다.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : '';
      const recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        await transcribeBlob(blob);
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      };
      recorderRef.current = recorder;
      recorder.start();
      setBusy('record');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '녹음에 실패했습니다.');
    }
  }

  function stopRecording() {
    recorderRef.current?.stop();
    setBusy('transcribe');
  }

  async function transcribeBlob(blob: Blob) {
    const ext = blob.type.includes('webm') ? 'webm' : 'mp4';
    const file = new File([blob], `voice.${ext}`, { type: blob.type });
    const fd = new FormData();
    fd.append('audio', file);
    try {
      const res = await fetch('/api/transcribe', { method: 'POST', body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '음성 변환에 실패했습니다.');
      const transcript: string = json.transcript || '';
      setText(transcript);
      setBusy(null);
      if (transcript.trim().length > 0) {
        await runExtract(transcript, 'voice');
      }
    } catch (e: unknown) {
      setBusy(null);
      setError(e instanceof Error ? e.message : '음성 변환에 실패했습니다.');
    }
  }

  async function runExtract(t: string, source: 'text' | 'voice') {
    setBusy('extract');
    setError(null);
    try {
      await onExtract(t, source);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '일정 추출에 실패했습니다.');
    } finally {
      setBusy(null);
    }
  }

  const showStop = busy === 'record';

  return (
    <div className="w-full">
      <div className="card p-2 focus-within:ring-4 focus-within:ring-[var(--ring)]">
        <textarea
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="메시지를 붙여넣거나 직접 입력하거나, 마이크를 눌러 말해보세요."
          className="w-full min-h-[160px] resize-none bg-transparent p-4 text-base outline-none placeholder:text-[var(--muted)]"
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && text.trim().length > 0) {
              runExtract(text, 'text');
            }
          }}
        />
        <div className="flex items-center justify-between px-2 pb-2">
          <button
            type="button"
            onClick={showStop ? stopRecording : startRecording}
            disabled={busy === 'extract' || busy === 'transcribe'}
            className={`flex items-center gap-2 rounded-full px-3 py-2 text-sm transition ${
              showStop ? 'bg-rose-600 text-white' : 'bg-[var(--surface-2)] text-[var(--fg)] hover:bg-[var(--border)]'
            } disabled:opacity-40`}
          >
            {showStop ? <Square className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            {showStop ? '정지' : busy === 'transcribe' ? '변환 중…' : '말하기'}
          </button>

          <button
            type="button"
            onClick={() => runExtract(text, 'text')}
            disabled={text.trim().length === 0 || busy !== null}
            className="btn-primary inline-flex items-center gap-2 disabled:opacity-40"
          >
            <Sparkles className="w-4 h-4" />
            {busy === 'extract' ? '분석 중…' : '일정 추출'}
          </button>
        </div>
      </div>

      {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}
      <p className="mt-3 text-xs text-[var(--muted)] text-center">
        ⌘/Ctrl + Enter로 추출 • 이메일·메신저 어디서든 붙여넣기
      </p>
    </div>
  );
}
