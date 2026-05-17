import type { NextRequest } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';
import { getSupabaseServerClient } from '@/lib/supabase/server';

/**
 * Resolve the user for widget endpoints — accepts either:
 *   - `?token=<ics_token>` query param (used by the Android widget app), or
 *   - the standard Supabase session cookie (used by the web app)
 *
 * Returns { userId } on success, null on failure. Caller should 401.
 *
 * The same `ics_token` already gates /api/ics/[token] (read-only event feed),
 * so reusing it for widget read access doesn't expand the trust boundary.
 */
export async function resolveWidgetUser(req: NextRequest): Promise<{ userId: string } | null> {
  const token = req.nextUrl.searchParams.get('token');
  if (token && token.length >= 16) {
    const admin = getSupabaseAdminClient();
    const { data } = await admin
      .from('profiles')
      .select('id')
      .eq('ics_token', token)
      .single();
    if (data) return { userId: data.id };
    return null; // token provided but invalid
  }

  // Fall back to cookie session
  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) return { userId: user.id };
  return null;
}
