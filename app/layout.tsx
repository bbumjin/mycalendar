import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import './globals.css';

export const metadata: Metadata = {
  title: 'AI 캘린더 — 붙여넣고 바로 저장',
  description: '어떤 텍스트나 음성이든 몇 초 만에 알림이 설정된 캘린더 일정으로 만들어드립니다.',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'AI 캘린더' },
  icons: { icon: '/icon.svg', apple: '/icon.svg' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f7f7f5' },
    { media: '(prefers-color-scheme: dark)', color: '#0b0b0d' },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko" className="h-full">
      <body className="min-h-dvh flex flex-col">
        {/* Apply persisted font scale before hydration so layout doesn't jump. */}
        <Script id="apply-font-scale" strategy="beforeInteractive">
          {"try{var s=parseFloat(localStorage.getItem('fontScale'));if(s>0&&isFinite(s)){document.documentElement.style.fontSize=Math.round(s*16)+'px';}}catch(e){}"}
        </Script>
        {children}
      </body>
    </html>
  );
}
