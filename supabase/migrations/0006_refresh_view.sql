-- Root cause of "day/event pages show no events": events_with_reminders was
-- created as `select e.*` in 0001, so its column list was frozen to the columns
-- that existed then. Columns added later — source_provider (0003),
-- subscription_id (0004) — are NOT in the view, so selecting them 400s and the
-- query returns null. Recreate the view so `e.*` re-expands to all current
-- columns. (CREATE OR REPLACE can't reorder columns, so drop + recreate.)

drop view if exists public.events_with_reminders;

create view public.events_with_reminders as
select e.*,
       coalesce(
         (select jsonb_agg(jsonb_build_object('id', r.id, 'minutes_before', r.minutes_before, 'method', r.method) order by r.minutes_before desc)
            from public.reminders r where r.event_id = e.id),
         '[]'::jsonb
       ) as reminders
from public.events e;

grant select on public.events_with_reminders to anon, authenticated;
