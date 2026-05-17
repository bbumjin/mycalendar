'use client';

import { useState } from 'react';
import { Copy, ExternalLink, Check, Apple, Smartphone } from 'lucide-react';

export function SubscriptionCard({ token, origin }: { token: string; origin: string }) {
  const httpsUrl = `${origin}/api/ics/${token}`;
  const webcalUrl = httpsUrl.replace(/^https?:\/\//, 'webcal://');
  const [copied, setCopied] = useState(false);
  const [tokenCopied, setTokenCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(httpsUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }
  async function copyToken() {
    await navigator.clipboard.writeText(token);
    setTokenCopied(true);
    setTimeout(() => setTokenCopied(false), 1500);
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-[var(--muted)]">
        한 번만 폰 캘린더에 이 주소를 추가하면, 이후 저장하는 모든 일정이 자동으로 폰에 나타납니다.
        Google·Apple·Outlook 모두 지원하며 OAuth 권한 없이 동작합니다.
      </p>

      <div className="flex items-center gap-2">
        <input
          readOnly
          value={httpsUrl}
          className="input font-mono text-xs"
          onFocus={(e) => e.currentTarget.select()}
        />
        <button onClick={copy} className="btn-secondary text-sm shrink-0 inline-flex items-center gap-1.5">
          {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
          {copied ? '복사됨' : '복사'}
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <a
          href={webcalUrl}
          className="btn-primary text-sm inline-flex items-center justify-center gap-2"
        >
          <Apple className="w-4 h-4" /> 아이폰·iCloud에 추가
        </a>
        <a
          href={`https://calendar.google.com/calendar/u/0/r/settings/addbyurl?cid=${encodeURIComponent(httpsUrl)}`}
          target="_blank"
          rel="noreferrer"
          className="btn-secondary text-sm inline-flex items-center justify-center gap-2"
        >
          <ExternalLink className="w-4 h-4" /> Google 캘린더에 추가
        </a>
      </div>

      <details className="text-xs text-[var(--muted)]">
        <summary className="cursor-pointer">기기별 추가 방법 보기</summary>
        <div className="mt-2 space-y-2">
          <div>
            <p className="font-medium text-[var(--fg)]">아이폰 / iPad</p>
            <p>위 "아이폰·iCloud에 추가" 버튼을 폰 Safari로 누르면 자동으로 캘린더 앱에 추가 시트가 열립니다.</p>
          </div>
          <div>
            <p className="font-medium text-[var(--fg)]">안드로이드 (Google 캘린더)</p>
            <p>위 "Google 캘린더에 추가" 버튼 → URL 확인 → 추가. 폰의 Google 캘린더 앱이 자동으로 동기화합니다.</p>
          </div>
          <div>
            <p className="font-medium text-[var(--fg)]">Outlook</p>
            <p>Outlook → 캘린더 추가 → 웹에서 구독 → 위 URL 붙여넣기.</p>
          </div>
        </div>
      </details>

      <p className="text-[10px] text-[var(--muted)]">
        이 주소를 아는 사람은 누구나 일정을 읽을 수 있으니 공유에 주의해주세요.
      </p>

      <details className="rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] p-3 text-xs">
        <summary className="cursor-pointer font-medium text-[var(--fg)] inline-flex items-center gap-1.5">
          <Smartphone className="w-3.5 h-3.5" /> 갤럭시·안드로이드 위젯 토큰
        </summary>
        <div className="mt-3 space-y-2">
          <p className="text-[var(--muted)]">
            "AI 캘린더 위젯" Android 앱(<code className="font-mono">android/</code> 폴더)에서 사용할 인증 토큰입니다.
            앱 첫 실행 시 붙여넣으면 위젯이 일정을 받아옵니다.
          </p>
          <div className="flex items-center gap-2">
            <input
              readOnly
              value={token}
              className="input font-mono text-xs"
              onFocus={(e) => e.currentTarget.select()}
            />
            <button onClick={copyToken} className="btn-secondary text-sm shrink-0 inline-flex items-center gap-1.5">
              {tokenCopied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
              {tokenCopied ? '복사됨' : '복사'}
            </button>
          </div>
        </div>
      </details>
    </div>
  );
}
