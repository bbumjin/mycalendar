import { NextResponse, type NextRequest } from 'next/server';
import { issueOauthState } from '@/lib/oauth-state';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirect = process.env.GOOGLE_REDIRECT_URI;
  if (!clientId || !redirect) {
    return NextResponse.json(
      {
        error: 'google_not_configured',
        hint:
          'Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URI in .env.local. ' +
          'Create an OAuth client at https://console.cloud.google.com/apis/credentials with redirect URI ' +
          (redirect || 'http://localhost:3000/api/auth/google/callback') +
          ' and scope https://www.googleapis.com/auth/calendar.events',
      },
      { status: 501 }
    );
  }

  const returnPath = req.nextUrl.searchParams.get('return') || '/settings';
  const state = await issueOauthState('google', returnPath);

  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirect);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', 'https://www.googleapis.com/auth/calendar.events email profile');
  url.searchParams.set('access_type', 'offline');
  // 'select_account consent' forces both the account chooser and refresh-token re-issue.
  url.searchParams.set('prompt', 'select_account consent');
  url.searchParams.set('state', state);
  return NextResponse.redirect(url);
}
