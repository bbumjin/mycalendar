-- 0004: subscribe to external ICS calendars (Outlook published, any .ics URL)

create table if not exists public.calendar_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null default '구독 캘린더',
  ics_url text not null,
  color text,
  last_synced_at timestamptz,
  last_sync_error text,
  created_at timestamptz not null default now()
);
alter table public.calendar_subscriptions enable row level security;
drop policy if exists calendar_subscriptions_owner on public.calendar_subscriptions;
create policy calendar_subscriptions_owner on public.calendar_subscriptions
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Link imported events to their subscription
alter table public.events
  add column if not exists subscription_id uuid references public.calendar_subscriptions (id) on delete cascade;

-- Allow 'ics' as a source provider
alter table public.events drop constraint if exists events_source_provider_check;
alter table public.events
  add constraint events_source_provider_check
  check (source_provider in ('google','microsoft','ics'));

-- Dedupe key for ICS events: (subscription_id, external_event_id=UID)
create unique index if not exists events_subscription_unique_idx
  on public.events (subscription_id, external_event_id)
  where subscription_id is not null and external_event_id is not null;

-- Skip auto-default-reminders for any imported event (google/microsoft/ics).
-- Native MyCalendar events (source_provider null) still get the default reminders.
create or replace function public.attach_default_reminders()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  has_location boolean := new.location_text is not null and length(trim(new.location_text)) > 0;
begin
  if new.source_provider is not null then
    return new; -- imported events keep the provider's own reminders
  end if;
  if exists (select 1 from public.reminders where event_id = new.id) then
    return new;
  end if;
  if has_location then
    insert into public.reminders (event_id, user_id, minutes_before)
      values (new.id, new.user_id, 120), (new.id, new.user_id, 60), (new.id, new.user_id, 5);
  else
    insert into public.reminders (event_id, user_id, minutes_before)
      values (new.id, new.user_id, 60), (new.id, new.user_id, 5);
  end if;
  return new;
end;
$$;
