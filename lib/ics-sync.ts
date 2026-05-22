import type { SupabaseClient } from '@supabase/supabase-js';
import { parseIcs } from '@/lib/ics-parser';

export class IcsSyncError extends Error {}

type Subscription = {
  id: string;
  user_id: string;
  ics_url: string;
};

// Fetch an ICS URL, parse it, and upsert events into the events table for the
// given subscription. Removes local events that no longer exist upstream
// (within the fetched window). Returns counts.
export async function syncIcsSubscription(
  supabase: SupabaseClient,
  sub: Subscription
): Promise<{ imported: number; removed: number }> {
  // Outlook publishes webcal:// sometimes — normalize to https
  const url = sub.ics_url.replace(/^webcal:\/\//i, 'https://');

  let text: string;
  try {
    const res = await fetch(url, {
      headers: { Accept: 'text/calendar, text/plain, */*' },
      // ICS feeds can be largish; allow redirects (default) and no caching
      cache: 'no-store',
    });
    if (!res.ok) throw new IcsSyncError(`HTTP ${res.status}`);
    text = await res.text();
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'fetch failed';
    await supabase
      .from('calendar_subscriptions')
      .update({ last_sync_error: msg })
      .eq('id', sub.id);
    throw new IcsSyncError(msg);
  }

  if (!text.includes('BEGIN:VCALENDAR')) {
    const msg = 'ICS 형식이 아닙니다. 게시(Publish) ICS 링크가 맞는지 확인해주세요.';
    await supabase.from('calendar_subscriptions').update({ last_sync_error: msg }).eq('id', sub.id);
    throw new IcsSyncError(msg);
  }

  const parsed = parseIcs(text);
  const seenUids = new Set<string>();
  let imported = 0;

  for (const ev of parsed) {
    if (ev.cancelled) continue;
    seenUids.add(ev.uid);

    const row = {
      user_id: sub.user_id,
      title: ev.title,
      start_time: ev.start,
      end_time: ev.end,
      all_day: ev.allDay,
      location_text: ev.location,
      attendees: [] as string[],
      notes: ev.description,
      source_text: null,
      source_type: 'manual' as const,
      source_provider: 'ics' as const,
      subscription_id: sub.id,
      external_event_id: ev.uid,
      status: 'synced' as const,
      last_synced_at: new Date().toISOString(),
      needs_confirmation: false,
    };

    const { data: existing } = await supabase
      .from('events')
      .select('id')
      .eq('subscription_id', sub.id)
      .eq('external_event_id', ev.uid)
      .maybeSingle();

    if (existing) {
      await supabase.from('events').update(row).eq('id', existing.id);
    } else {
      await supabase.from('events').insert(row);
    }
    imported++;
  }

  // Remove local events for this subscription that vanished upstream.
  let removed = 0;
  const { data: locals } = await supabase
    .from('events')
    .select('id, external_event_id')
    .eq('subscription_id', sub.id);
  for (const l of locals ?? []) {
    if (l.external_event_id && !seenUids.has(l.external_event_id)) {
      await supabase.from('events').delete().eq('id', l.id);
      removed++;
    }
  }

  await supabase
    .from('calendar_subscriptions')
    .update({ last_synced_at: new Date().toISOString(), last_sync_error: null })
    .eq('id', sub.id);

  return { imported, removed };
}
