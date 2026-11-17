-- curator accounts: one row per person holding their crates, saves, chop points and settings.
-- Run this in your Supabase project's SQL editor. It's safe to run again (e.g. after updating curator).
create table if not exists public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Each person can only read and write their own row.
drop policy if exists "read own profile" on public.profiles;
create policy "read own profile" on public.profiles for select using (auth.uid() = user_id);
drop policy if exists "insert own profile" on public.profiles;
create policy "insert own profile" on public.profiles for insert with check (auth.uid() = user_id);
drop policy if exists "update own profile" on public.profiles;
create policy "update own profile" on public.profiles for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Shared crates: a read-only copy of a crate anyone with the link can open and add to their own.
create table if not exists public.shared_crates (
  id text primary key check (id ~ '^[a-z0-9]{6,24}$'),
  owner uuid not null default auth.uid() references auth.users (id) on delete cascade,
  crate jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.shared_crates enable row level security;

-- Anyone with the link can read a shared crate; only its owner can change or remove it.
drop policy if exists "anyone reads shared crates" on public.shared_crates;
create policy "anyone reads shared crates" on public.shared_crates for select using (true);
drop policy if exists "owner shares crates" on public.shared_crates;
create policy "owner shares crates" on public.shared_crates for insert with check (auth.uid() = owner);
drop policy if exists "owner updates shared crates" on public.shared_crates;
create policy "owner updates shared crates" on public.shared_crates for update using (auth.uid() = owner) with check (auth.uid() = owner);
drop policy if exists "owner unshares crates" on public.shared_crates;
create policy "owner unshares crates" on public.shared_crates for delete using (auth.uid() = owner);
