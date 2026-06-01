-- Performance: cut per-request and per-row latency on the hot read paths.
--
-- 1. RLS policies called auth.uid() bare, so Postgres re-evaluated it for every
--    scanned row on events/reminders (the tables read on every calendar, widget
--    and briefing request). Wrapping it as (select auth.uid()) lets the planner
--    cache it as a one-per-statement InitPlan. Behaviour is identical; this is
--    the official Supabase recommendation.

alter policy profiles_self on public.profiles
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

alter policy calendar_accounts_owner on public.calendar_accounts
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

alter policy events_owner on public.events
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

alter policy reminders_owner on public.reminders
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

alter policy voice_transcripts_owner on public.voice_transcripts
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

alter policy briefings_owner on public.briefings
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

alter policy calendar_subscriptions_owner on public.calendar_subscriptions
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- 2. Missing indexes. events(user_id, start_time) already covers the main read
--    path, but these user/FK lookups were seq-scanning:
--    - reminders filtered by user_id (RLS + reminder queries)
--    - events by calendar_account_id / subscription_id (sync + cascade deletes)

create index if not exists reminders_user_idx
  on public.reminders (user_id);

create index if not exists events_calendar_account_idx
  on public.events (calendar_account_id)
  where calendar_account_id is not null;

create index if not exists events_subscription_idx
  on public.events (subscription_id)
  where subscription_id is not null;
