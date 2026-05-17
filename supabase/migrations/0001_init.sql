-- AI Calendar MVP — initial schema
-- Idempotent: safe to re-run during dev

-- 1. profiles  (1:1 with auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  display_name text,
  timezone text not null default 'Asia/Seoul',
  default_calendar_account_id uuid,
  morning_briefing_time time not null default '08:00',
  night_briefing_time time not null default '22:00',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
drop policy if exists profiles_self on public.profiles;
create policy profiles_self on public.profiles
  for all using (id = auth.uid()) with check (id = auth.uid());

-- 2. calendar_accounts  (Google / Microsoft connections)
create table if not exists public.calendar_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  provider text not null check (provider in ('google','microsoft')),
  provider_account_email text not null,
  access_token text not null,
  refresh_token text,
  token_expires_at timestamptz,
  selected_calendar_id text,
  selected_calendar_name text,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider, provider_account_email)
);
alter table public.calendar_accounts enable row level security;
drop policy if exists calendar_accounts_owner on public.calendar_accounts;
create policy calendar_accounts_owner on public.calendar_accounts
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 3. events
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  start_time timestamptz not null,
  end_time timestamptz not null,
  all_day boolean not null default false,
  location_text text,
  attendees text[] not null default '{}',
  notes text,
  source_text text,
  source_type text not null default 'manual' check (source_type in ('text','voice','manual')),
  ai_confidence numeric,
  needs_confirmation boolean not null default false,
  status text not null default 'saved' check (status in ('draft','saved','synced','failed')),
  calendar_account_id uuid references public.calendar_accounts (id) on delete set null,
  external_event_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists events_user_time_idx on public.events (user_id, start_time);
alter table public.events enable row level security;
drop policy if exists events_owner on public.events;
create policy events_owner on public.events
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 4. reminders
create table if not exists public.reminders (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  minutes_before int not null,
  method text not null default 'notification' check (method in ('notification','email')),
  created_at timestamptz not null default now()
);
create index if not exists reminders_event_idx on public.reminders (event_id);
alter table public.reminders enable row level security;
drop policy if exists reminders_owner on public.reminders;
create policy reminders_owner on public.reminders
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 5. voice_transcripts
create table if not exists public.voice_transcripts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  transcript text not null,
  duration_seconds numeric,
  used_for_event_id uuid references public.events (id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.voice_transcripts enable row level security;
drop policy if exists voice_transcripts_owner on public.voice_transcripts;
create policy voice_transcripts_owner on public.voice_transcripts
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 6. briefings  (computed by Edge Function `daily-briefing`)
create table if not exists public.briefings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('morning','night')),
  for_date date not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  unique (user_id, kind, for_date)
);
alter table public.briefings enable row level security;
drop policy if exists briefings_owner on public.briefings;
create policy briefings_owner on public.briefings
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 7. profiles.default_calendar_account_id FK (added late to avoid circularity)
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_default_calendar_fk'
  ) then
    alter table public.profiles
      add constraint profiles_default_calendar_fk
      foreign key (default_calendar_account_id)
      references public.calendar_accounts (id)
      on delete set null;
  end if;
end$$;

-- 8. auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 9. updated_at touch trigger (generic)
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch
  before update on public.profiles
  for each row execute function public.touch_updated_at();

drop trigger if exists events_touch on public.events;
create trigger events_touch
  before update on public.events
  for each row execute function public.touch_updated_at();

drop trigger if exists calendar_accounts_touch on public.calendar_accounts;
create trigger calendar_accounts_touch
  before update on public.calendar_accounts
  for each row execute function public.touch_updated_at();

-- 10. auto-attach default reminders for events without any
create or replace function public.attach_default_reminders()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  has_location boolean := new.location_text is not null and length(trim(new.location_text)) > 0;
begin
  -- only run for fresh events whose client did not pre-insert reminders
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

drop trigger if exists events_default_reminders on public.events;
create trigger events_default_reminders
  after insert on public.events
  for each row execute function public.attach_default_reminders();

-- 10a. atomic reminder replacement RPC
create or replace function public.replace_event_reminders(p_event_id uuid, p_reminders jsonb)
returns void
language plpgsql
security invoker  -- runs with caller's RLS rights
set search_path = public
as $$
declare
  uid uuid;
begin
  -- ensure caller owns the event
  select user_id into uid from public.events where id = p_event_id;
  if uid is null or uid <> auth.uid() then
    raise exception 'event not found or not owned by caller';
  end if;

  delete from public.reminders where event_id = p_event_id;

  if jsonb_typeof(p_reminders) = 'array' and jsonb_array_length(p_reminders) > 0 then
    insert into public.reminders (event_id, user_id, minutes_before, method)
    select
      p_event_id,
      uid,
      (r->>'minutes_before')::int,
      coalesce(r->>'method', 'notification')
    from jsonb_array_elements(p_reminders) as r;
  end if;
end;
$$;

grant execute on function public.replace_event_reminders(uuid, jsonb) to authenticated;

-- 11. helpful view: events_with_reminders (no RLS — view inherits RLS from base tables)
create or replace view public.events_with_reminders as
select e.*,
       coalesce(
         (select jsonb_agg(jsonb_build_object('id', r.id, 'minutes_before', r.minutes_before, 'method', r.method) order by r.minutes_before desc)
            from public.reminders r where r.event_id = e.id),
         '[]'::jsonb
       ) as reminders
from public.events e;

grant select on public.events_with_reminders to anon, authenticated;
