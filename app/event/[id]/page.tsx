import { AppShell, PageTitle } from '@/components/AppShell';
import { requireUser } from '@/lib/supabase/server';
import type { EventRow } from '@/lib/types';
import { EventEditor } from './EventEditor';

export const dynamic = 'force-dynamic';

export default async function EventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, user } = await requireUser();
  if (!user) return null;

  // Fetch on the server so the form paints from the initial HTML — no client
  // fetch-on-mount round trip or "불러오는 중…" spinner.
  // NB: events_with_reminders was created `select e.*` in 0001, so its columns
  // predate source_provider (0003) — selecting it 400s. Omit it; the provider
  // label is simply absent (as it was before this query existed).
  const { data } = await supabase
    .from('events_with_reminders')
    .select('id, title, start_time, end_time, location_text, attendees, notes, reminders, status')
    .eq('id', id)
    .eq('user_id', user.id)
    .single();

  if (!data) {
    return (
      <AppShell>
        <PageTitle>일정</PageTitle>
        <p className="text-rose-600 text-sm">일정을 찾을 수 없습니다.</p>
      </AppShell>
    );
  }

  return <EventEditor event={data as unknown as EventRow} />;
}
