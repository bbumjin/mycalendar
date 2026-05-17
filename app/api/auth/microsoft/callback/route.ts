import { NextResponse, type NextRequest } from 'next/server';
import { requireUser } from '@/lib/supabase/server';
import { consumeOauthState } from '@/lib/oauth-state';
import { pullMicrosoftEvents } from '@/lib/microsoft-calendar';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url);
  const code = searchParams.get('code');
  const rawState = searchParams.get('state');
  const stateCheck = await consumeOauthState('microsoft', rawState);
  const back = stateCheck.return;

  if (!stateCheck.ok) {
    return NextResponse.redirect(`${origin}/settings?error=invalid_state`);
  }
  if (!code) return NextResponse.redirect(`${origin}/settings?error=missing_code`);

  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
  const redirect = process.env.MICROSOFT_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirect) {
    return NextResponse.redirect(`${origin}/settings?error=microsoft_not_configured`);
  }

  const tokenRes = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirect,
      grant_type: 'authorization_code',
      scope: 'Calendars.ReadWrite offline_access User.Read',
    }),
  });
  const tokens = await tokenRes.json();
  if (!tokenRes.ok) return NextResponse.redirect(`${origin}/settings?error=token_exchange`);

  const userRes = await fetch('https://graph.microsoft.com/v1.0/me', {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  const me = await userRes.json();

  const { supabase, user } = await requireUser();
  if (!user) return NextResponse.redirect(`${origin}/login`);

  const expiresAt = new Date(Date.now() + (tokens.expires_in ?? 3600) * 1000).toISOString();
  const { data: account } = await supabase
    .from('calendar_accounts')
    .upsert(
      {
        user_id: user.id,
        provider: 'microsoft',
        provider_account_email: me.userPrincipalName || me.mail || 'unknown',
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token ?? null,
        token_expires_at: expiresAt,
        selected_calendar_id: 'primary',
        selected_calendar_name: me.userPrincipalName || me.mail || 'Microsoft',
        is_default: false,
      },
      { onConflict: 'user_id,provider,provider_account_email' }
    )
    .select('id, user_id, provider, access_token, refresh_token, token_expires_at, selected_calendar_id')
    .single();

  if (account) {
    pullMicrosoftEvents(supabase, account).catch((e) => {
      console.error('Initial Microsoft pull failed:', e);
      supabase
        .from('calendar_accounts')
        .update({ last_sync_error: e instanceof Error ? e.message : String(e) })
        .eq('id', account.id)
        .then(() => {});
    });
  }

  return NextResponse.redirect(`${origin}${back}`);
}
