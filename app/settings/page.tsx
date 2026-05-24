import { headers } from 'next/headers';
import { AppShell, PageTitle } from '@/components/AppShell';
import { requireUser } from '@/lib/supabase/server';
import { ProfileForm } from './ProfileForm';
import { ConnectedCalendars } from './ConnectedCalendars';
import { SubscriptionCard } from './SubscriptionCard';
import { IcsSubscriptions } from './IcsSubscriptions';
import { FontSizeSetting } from './FontSizeSetting';
import { LogOut } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const { supabase, user } = await requireUser();
  if (!user) return null;

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();

  const hdrs = await headers();
  const host = hdrs.get('x-forwarded-host') || hdrs.get('host') || 'localhost:3000';
  const proto = hdrs.get('x-forwarded-proto') || 'https';
  const origin = `${proto}://${host}`;
  const { data: accountsRaw } = await supabase
    .from('calendar_accounts')
    .select('id, provider, provider_account_email, selected_calendar_name, is_default, token_expires_at, last_synced_at, last_sync_error')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true });

  const googleEnabled = !!process.env.GOOGLE_CLIENT_ID;
  const microsoftEnabled = !!process.env.MICROSOFT_CLIENT_ID;

  return (
    <AppShell active="settings">
      <PageTitle sub={user.email || ''}>설정</PageTitle>

      <section className="card p-5 mb-4">
        <h2 className="font-medium mb-1">글자 크기</h2>
        <p className="text-xs text-[var(--muted)] mb-3">앱 전체 글자/요소 크기를 조절합니다. 즉시 적용돼요.</p>
        <FontSizeSetting />
      </section>

      <section className="card p-5 mb-4">
        <h2 className="font-medium mb-3">프로필</h2>
        <ProfileForm
          initial={{
            display_name: profile?.display_name ?? '',
            timezone: profile?.timezone ?? 'Asia/Seoul',
            morning_briefing_time: profile?.morning_briefing_time?.slice(0, 5) ?? '08:00',
            night_briefing_time: profile?.night_briefing_time?.slice(0, 5) ?? '22:00',
          }}
        />
      </section>

      <section className="card p-5 mb-4">
        <h2 className="font-medium mb-1">캘린더 구독 (추천)</h2>
        {profile?.ics_token ? (
          <SubscriptionCard token={profile.ics_token} origin={origin} />
        ) : (
          <p className="text-xs text-[var(--muted)]">잠시 후 다시 시도해주세요. 구독 주소를 준비 중입니다.</p>
        )}
      </section>

      <section className="card p-5 mb-4">
        <h2 className="font-medium mb-1">ICS 링크로 가져오기 (추천)</h2>
        <IcsSubscriptions />
      </section>

      <section className="card p-5 mb-4">
        <h2 className="font-medium mb-1">계정 연결로 가져오기 (양방향)</h2>
        <p className="text-xs text-[var(--muted)] mb-4">
          Google·Outlook 계정을 OAuth로 연결하면 양방향 동기화됩니다. 회사 계정은 관리자 동의가 필요할 수 있어요 —
          그럴 땐 위 ICS 링크 방식을 쓰세요.
        </p>
        <ConnectedCalendars
          initialAccounts={accountsRaw ?? []}
          googleEnabled={googleEnabled}
          microsoftEnabled={microsoftEnabled}
        />
      </section>

      <section className="card p-5">
        <h2 className="font-medium mb-3">계정</h2>
        <form action="/api/auth/signout" method="post">
          <button className="btn-secondary inline-flex items-center gap-2 text-sm">
            <LogOut className="w-4 h-4" /> 로그아웃
          </button>
        </form>
      </section>
    </AppShell>
  );
}
