import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function getSupabaseServerClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(toSet) {
          try {
            toSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // setAll called from a Server Component — safe to ignore
          }
        },
      },
    }
  );
}

// Resolve the caller from the JWT claims instead of getUser(). getClaims()
// verifies the access token locally via the cached JWKS (with asymmetric signing
// keys), avoiding a network round-trip to the Auth server on every request; with
// legacy HS256 secrets it transparently falls back to a server check, so this is
// never slower. Security is still enforced by RLS (auth.uid()) on every query.
// Every caller only reads user.id / user.email, so a minimal object suffices.
export async function requireUser() {
  const supabase = await getSupabaseServerClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  const user = claims ? { id: claims.sub, email: claims.email } : null;
  return { supabase, user };
}
