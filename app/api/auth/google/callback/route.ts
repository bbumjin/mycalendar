import { NextResponse, type NextRequest } from 'next/server';
import { requireUser } from '@/lib/supabase/server';
import { consumeOauthState } from '@/lib/oauth-state';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url);
  const code = searchParams.get('code');
  const rawState = searchParams.get('state');
  const stateCheck = await consumeOauthState('google', rawState);
  const back = stateCheck.return;

  if (!stateCheck.ok) {
    return NextResponse.redirect(`${origin}/settings?error=invalid_state`);
  }
  if (!code) return NextResponse.redirect(`${origin}/settings?error=missing_code`);

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirect = process.env.GOOGLE_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirect) {
    return NextResponse.redirect(`${origin}/settings?error=google_not_configured`);
  }

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirect,
      grant_type: 'authorization_code',
    }),
  });
  const tokens = await tokenRes.json();
  if (!tokenRes.ok) return NextResponse.redirect(`${origin}/settings?error=token_exchange`);

  const userinfoRes = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  const userinfo = await userinfoRes.json();

  const { supabase, user } = await requireUser();
  if (!user) return NextResponse.redirect(`${origin}/login`);

  const expiresAt = new Date(Date.now() + (tokens.expires_in ?? 3600) * 1000).toISOString();
  await supabase
    .from('calendar_accounts')
    .upsert(
      {
        user_id: user.id,
        provider: 'google',
        provider_account_email: userinfo.email,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token ?? null,
        token_expires_at: expiresAt,
        selected_calendar_id: 'primary',
        selected_calendar_name: userinfo.email,
        is_default: true,
      },
      { onConflict: 'user_id,provider,provider_account_email' }
    );

  return NextResponse.redirect(`${origin}${back}`);
}
