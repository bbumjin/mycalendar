import { NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

const REQUIRED = ['profiles', 'calendar_accounts', 'events', 'reminders', 'voice_transcripts', 'briefings', 'events_with_reminders'];

export async function GET() {
  const admin = getSupabaseAdminClient();
  const results: Record<string, { ok: boolean; error?: string }> = {};

  await Promise.all(
    REQUIRED.map(async (t) => {
      // Use a real select (not head:true count) because PGRST205 schema-cache
      // misses surface as an `error` here, but are silently swallowed under head:true.
      const { error } = await admin.from(t).select('*').limit(1);
      results[t] = error ? { ok: false, error: error.message } : { ok: true };
    })
  );

  const missing = REQUIRED.filter((t) => !results[t].ok);
  return NextResponse.json({ ok: missing.length === 0, missing, results });
}
