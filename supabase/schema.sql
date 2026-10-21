-- Espresso Kompass: accounts and saved data.
-- Lives in its own schema "coffee" so it can share a Supabase project with
-- another app (here: the wine app) without touching that app's tables.
-- Run once in the Supabase dashboard: SQL Editor → New query → paste → Run.
-- Safe to run again.

create schema if not exists coffee;
grant usage on schema coffee to authenticated;

-- Display name per user in the coffee app ("Wie möchtest du heißen?").
create table if not exists coffee.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 40),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- The app state of each user as one JSON document
-- (beans, shots, ratings, own recipes, brew log, settings).
create table if not exists coffee.user_data (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint user_data_size check (pg_column_size(data) < 2000000)
);

-- Row Level Security: everyone sees and changes only their own rows.
alter table coffee.profiles enable row level security;
alter table coffee.user_data enable row level security;

drop policy if exists "profiles: read own" on coffee.profiles;
drop policy if exists "profiles: insert own" on coffee.profiles;
drop policy if exists "profiles: update own" on coffee.profiles;
create policy "profiles: read own" on coffee.profiles
  for select to authenticated using ((select auth.uid()) = id);
create policy "profiles: insert own" on coffee.profiles
  for insert to authenticated with check ((select auth.uid()) = id);
create policy "profiles: update own" on coffee.profiles
  for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

drop policy if exists "user_data: read own" on coffee.user_data;
drop policy if exists "user_data: insert own" on coffee.user_data;
drop policy if exists "user_data: update own" on coffee.user_data;
create policy "user_data: read own" on coffee.user_data
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "user_data: insert own" on coffee.user_data
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "user_data: update own" on coffee.user_data
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- Only signed-in users, only these three operations.
revoke all on all tables in schema coffee from anon, public;
grant select, insert, update on coffee.profiles, coffee.user_data to authenticated;

-- Last step (not SQL): Project Settings → Data API → "Exposed schemas" → add "coffee".
