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

-- The shared sound index: a Discogs-EffNet fingerprint (1280 numbers) for every song
-- curator has heard, so "Similar songs" can search all of them by sound.
-- Only curator's server reads and writes it (no policies = no public access).
create extension if not exists vector with schema extensions;

create table if not exists public.sounds (
  id text primary key,
  -- "artist|title", normalised: one row per recording whatever the source.
  song_key text not null,
  emb extensions.halfvec(1280) not null,
  artist text not null,
  title text not null,
  year int,
  style text,
  track jsonb not null,
  added_at timestamptz not null default now()
);
create unique index if not exists sounds_song_key on public.sounds (song_key);
create index if not exists sounds_emb on public.sounds using hnsw (emb extensions.halfvec_cosine_ops);
create index if not exists sounds_year on public.sounds (year);
alter table public.sounds enable row level security;

-- Nearest songs by sound (cosine), optionally within years, skipping some ids.
create or replace function public.similar_sounds(q extensions.halfvec, n int, skip text[] default '{}', min_year int default null, max_year int default null)
returns table (id text, track jsonb, score double precision)
language sql stable
set search_path = public, extensions
set hnsw.ef_search = 400
set hnsw.iterative_scan = relaxed_order
as $$
  select s.id, s.track, 1 - (s.emb <=> q) as score
  from public.sounds s
  where s.id <> all (skip)
    and (min_year is null or s.year is null or s.year >= min_year)
    and (max_year is null or s.year is null or s.year <= max_year)
  order by s.emb <=> q
  limit least(n, 300);
$$;
revoke all on function public.similar_sounds from public, anon, authenticated;

-- Adds songs to the index; songs already there (same id or same song) are skipped.
create or replace function public.add_sounds(items jsonb)
returns int
language sql
set search_path = public, extensions
as $$
  with ins as (
    insert into public.sounds (id, song_key, emb, artist, title, year, style, track)
    select x.id, x.song_key, x.emb::halfvec(1280), x.artist, x.title, x.year, x.style, x.track
    from jsonb_to_recordset(items) as x(id text, song_key text, emb text, artist text, title text, year int, style text, track jsonb)
    on conflict do nothing
    returning 1
  )
  select count(*)::int from ins;
$$;
revoke all on function public.add_sounds from public, anon, authenticated;

-- Which of these songs are already indexed (by id or song key).
create or replace function public.known_sounds(ids text[], keys text[])
returns table (id text, song_key text)
language sql stable
set search_path = public
as $$
  select s.id, s.song_key from public.sounds s where s.id = any (ids) or s.song_key = any (keys);
$$;
revoke all on function public.known_sounds from public, anon, authenticated;
