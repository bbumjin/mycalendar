// Supabase Edge Function: daily-briefing
//
// Trigger: pg_cron every 15 minutes. Selects users whose
// morning_briefing_time or night_briefing_time falls within a +/- 7 minute
// window of the current time (translated through their `profiles.timezone`),
// computes the briefing payload from `events`, and upserts a `briefings` row.
//
// Deploy:
//   supabase functions deploy daily-briefing --no-verify-jwt
// Schedule with pg_cron:
//   select cron.schedule('daily-briefing', '*/15 * * * *',
//     $$ select net.http_post(
//          url := 'https://<ref>.functions.supabase.co/daily-briefing',
//          headers := jsonb_build_object('Content-Type','application/json',
//                                        'Authorization','Bearer ' || current_setting('app.cron_secret', true))
//        ); $$);

// @ts-expect-error - deno-style imports resolved at runtime in Edge Functions
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Edge Function entry: Deno.serve is provided by the runtime.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const Deno: any;

Deno.serve(async () => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const admin = createClient(supabaseUrl, serviceRole);

  const now = new Date();

  // Pull all profiles; filter in JS by time-of-day in their timezone.
  const { data: profiles, error } = await admin
    .from('profiles')
    .select('id, timezone, morning_briefing_time, night_briefing_time');
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

  const matches: { user_id: string; kind: 'morning' | 'night'; for_date: string; target_date: string; tz: string }[] = [];

  for (const p of profiles ?? []) {
    const tz = p.timezone || 'Asia/Seoul';
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
    const parts = Object.fromEntries(fmt.formatToParts(now).map((p) => [p.type, p.value]));
    const localMinutes = Number(parts.hour) * 60 + Number(parts.minute);
    const todayLocal = `${parts.year}-${parts.month}-${parts.day}`;

    for (const kind of ['morning', 'night'] as const) {
      const t = kind === 'morning' ? p.morning_briefing_time : p.night_briefing_time;
      if (!t) continue;
      const [hh, mm] = (t as string).split(':').map(Number);
      const targetMinutes = hh * 60 + mm;
      if (Math.abs(targetMinutes - localMinutes) <= 7) {
        const target = kind === 'morning' ? todayLocal : addOneDay(todayLocal);
        matches.push({ user_id: p.id, kind, for_date: todayLocal, target_date: target, tz });
      }
    }
  }

  for (const m of matches) {
    // Convert the user's local day (target_date in m.tz) into UTC range.
    const { fromUtc, toUtc } = localDayToUtcRange(m.target_date, m.tz);
    const { data: events } = await admin
      .from('events_with_reminders')
      .select('*')
      .eq('user_id', m.user_id)
      .gte('start_time', fromUtc)
      .lte('start_time', toUtc)
      .order('start_time', { ascending: true });

    const list = events || [];
    const payload = {
      kind: m.kind,
      target_date: m.target_date,
      events: list,
      first_event: list[0] ?? null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      located_events: list.filter((e: any) => !!e.location_text),
    };

    await admin
      .from('briefings')
      .upsert(
        { user_id: m.user_id, kind: m.kind, for_date: m.for_date, payload },
        { onConflict: 'user_id,kind,for_date' }
      );
  }

  return new Response(JSON.stringify({ processed: matches.length }), {
    headers: { 'Content-Type': 'application/json' },
  });
});

function addOneDay(yyyymmdd: string): string {
  const [y, m, d] = yyyymmdd.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + 1);
  return dt.toISOString().slice(0, 10);
}

// Returns ISO strings spanning [00:00:00, 23:59:59.999] of `yyyymmdd` in `tz`, in UTC.
function localDayToUtcRange(yyyymmdd: string, tz: string): { fromUtc: string; toUtc: string } {
  return {
    fromUtc: wallTimeToUtcIso(`${yyyymmdd}T00:00:00`, tz),
    toUtc: wallTimeToUtcIso(`${yyyymmdd}T23:59:59.999`, tz),
  };
}

function wallTimeToUtcIso(local: string, tz: string): string {
  const [datePart, timePart] = local.split('T');
  const [y, mo, d] = datePart.split('-').map(Number);
  const [h, mi, sFull] = (timePart || '00:00:00').split(':');
  const [s, ms] = (sFull || '0').split('.');
  const utc = Date.UTC(y, mo - 1, d, Number(h), Number(mi), Number(s || 0), Number(ms || 0));
  const tzString = new Date(utc).toLocaleString('en-US', { timeZone: tz, hour12: false });
  const guessed = new Date(tzString + ' UTC');
  const diff = guessed.getTime() - utc;
  return new Date(utc - diff).toISOString();
}
