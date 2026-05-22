import { NextResponse, type NextRequest } from 'next/server';
import { issueOauthState } from '@/lib/oauth-state';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const redirect = process.env.MICROSOFT_REDIRECT_URI;
  if (!clientId || !redirect) {
    return NextResponse.json(
      {
        error: 'microsoft_not_configured',
        hint:
          'Set MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET, and MICROSOFT_REDIRECT_URI in .env.local. ' +
          'Register an app at https://entra.microsoft.com → App registrations with redirect URI ' +
          (redirect || 'http://localhost:3000/api/auth/microsoft/callback') +
          ' and scopes Calendars.ReadWrite offline_access User.Read',
      },
      { status: 501 }
    );
  }

  const returnPath = req.nextUrl.searchParams.get('return') || '/settings';
  const state = await issueOauthState('microsoft', returnPath);

  const url = new URL('https://login.microsoftonline.com/common/oauth2/v2.0/authorize');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirect);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'Calendars.ReadWrite offline_access User.Read');
  url.searchParams.set('response_mode', 'query');
  // Always show the account picker so users with multiple Microsoft accounts
  // aren't silently signed into a cached session.
  url.searchParams.set('prompt', 'select_account');
  url.searchParams.set('state', state);
  return NextResponse.redirect(url);
}
