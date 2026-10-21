-- Espresso Kompass: accounts and saved data.
-- Run once in the Supabase dashboard: SQL Editor → New query → paste → Run.
-- Safe to run again.

-- Display name per user ("Wie möchtest du heißen?").
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 40),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- The app state of each user as one JSON document
-- (beans, shots, ratings, own recipes, brew log, settings).
create table if not exists public.user_data (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint user_data_size check (pg_column_size(data) < 2000000)
);

-- Row Level Security: everyone sees and changes only their own rows.
alter table public.profiles enable row level security;
alter table public.user_data enable row level security;

drop policy if exists "profiles: read own" on public.profiles;
drop policy if exists "profiles: insert own" on public.profiles;
drop policy if exists "profiles: update own" on public.profiles;
create policy "profiles: read own" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);
create policy "profiles: insert own" on public.profiles
  for insert to authenticated with check ((select auth.uid()) = id);
create policy "profiles: update own" on public.profiles
  for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

drop policy if exists "user_data: read own" on public.user_data;
drop policy if exists "user_data: insert own" on public.user_data;
drop policy if exists "user_data: update own" on public.user_data;
create policy "user_data: read own" on public.user_data
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "user_data: insert own" on public.user_data
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "user_data: update own" on public.user_data
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- Nobody without an account gets anything.
revoke all on public.profiles, public.user_data from anon;
grant select, insert, update on public.profiles, public.user_data to authenticated;
