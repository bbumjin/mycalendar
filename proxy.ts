import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const PUBLIC_PATHS = [
  '/login',
  '/auth/callback',
  '/setup',
  '/api/setup/health',
  '/api/ics', // /api/ics/[token] is publicly accessible by anyone with the token
  '/api/widget', // /api/widget/* accept ?token=<ics_token> for Android widget access
];

export async function proxy(req: NextRequest) {
  const res = NextResponse.next({ request: { headers: req.headers } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(toSet) {
          toSet.forEach(({ name, value, options }) => {
            req.cookies.set(name, value);
            res.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  // getClaims() still refreshes an expiring session (it calls getSession()
  // internally, which writes refreshed cookies via setAll above), but verifies
  // the JWT locally against the cached JWKS instead of a network round-trip to
  // the Auth server on every request. Only presence is needed for gating.
  const { data } = await supabase.auth.getClaims();
  const user = data?.claims ?? null;

  const { pathname } = req.nextUrl;
  const isPublic =
    PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/')) ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/manifest') ||
    pathname.startsWith('/icons');

  if (!user && !isPublic) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  if (user && pathname === '/login') {
    const url = req.nextUrl.clone();
    url.pathname = '/';
    return NextResponse.redirect(url);
  }

  return res;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|json)$).*)'],
};
