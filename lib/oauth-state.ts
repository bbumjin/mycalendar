import { cookies } from 'next/headers';
import { randomBytes } from 'node:crypto';

export type OauthStatePayload = {
  nonce: string;
  return: string;
};

function cookieName(provider: 'google' | 'microsoft') {
  return `oauth_${provider}_state`;
}

export async function issueOauthState(
  provider: 'google' | 'microsoft',
  returnPath: string
): Promise<string> {
  const nonce = randomBytes(16).toString('hex');
  const c = await cookies();
  c.set(cookieName(provider), nonce, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 300,
  });
  const payload: OauthStatePayload = { nonce, return: returnPath };
  return Buffer.from(JSON.stringify(payload)).toString('base64url');
}

export async function consumeOauthState(
  provider: 'google' | 'microsoft',
  raw: string | null
): Promise<{ ok: boolean; return: string }> {
  const c = await cookies();
  const cookie = c.get(cookieName(provider));
  c.delete(cookieName(provider));
  if (!raw || !cookie) return { ok: false, return: '/settings' };
  try {
    const payload = JSON.parse(Buffer.from(raw, 'base64url').toString()) as OauthStatePayload;
    if (payload.nonce !== cookie.value) return { ok: false, return: payload.return || '/settings' };
    return { ok: true, return: payload.return || '/settings' };
  } catch {
    return { ok: false, return: '/settings' };
  }
}
