-- 0003: enable importing events FROM connected calendars.

-- Source provider tag. NULL = native MyCalendar event; 'google' / 'microsoft' = imported.
alter table public.events
  add column if not exists source_provider text check (source_provider in ('google','microsoft'));

-- When was this event last synced from the provider?
alter table public.events
  add column if not exists last_synced_at timestamptz;

-- Per-account unique external id so we can upsert on subsequent pulls.
create unique index if not exists events_external_unique_idx
  on public.events (calendar_account_id, external_event_id)
  where calendar_account_id is not null and external_event_id is not null;

-- Helpful filter index
create index if not exists events_provider_idx
  on public.events (user_id, source_provider, start_time);

-- Track the last successful sync per calendar account.
alter table public.calendar_accounts
  add column if not exists last_synced_at timestamptz,
  add column if not exists last_sync_error text;
