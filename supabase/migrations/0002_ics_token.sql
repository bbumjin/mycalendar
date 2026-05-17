-- 0002: add per-user ICS subscription token

alter table public.profiles
  add column if not exists ics_token text unique;

-- Auto-generate a token for any new profile.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  insert into public.profiles (id, email, ics_token)
  values (new.id, new.email, encode(gen_random_bytes(24), 'hex'))
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Backfill any existing profiles missing a token.
update public.profiles
   set ics_token = encode(gen_random_bytes(24), 'hex')
 where ics_token is null;
