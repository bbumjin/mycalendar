import { createClient } from '@supabase/supabase-js';

// Service-role client. Use ONLY in route handlers where you must bypass RLS
// (e.g. health checks). Never expose this to the browser.
export function getSupabaseAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { persistSession: false, autoRefreshToken: false },
    }
  );
}
