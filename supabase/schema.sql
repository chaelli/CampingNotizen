-- CampingNotizen – Datenbankschema für Supabase.
-- Im Supabase-Dashboard unter "SQL Editor" ausführen.
--
-- Sicherheits-Hinweis (ehrlich): Der Zugriff wird über den geteilten
-- Zugangscode geregelt (als Hash = "board" gespeichert). Die Policies erlauben
-- dem anon-Key Lesen/Schreiben. Wer den anon-Key UND einen board-Hash kennt,
-- kann auf diesen Platz zugreifen. Für einen Freundeskreis auf dem Campingplatz
-- ist das ok; es ist aber KEINE starke Mandantentrennung.

create extension if not exists "pgcrypto";

-- Wohnwagen ------------------------------------------------------------------
create table if not exists public.caravans (
  id uuid primary key default gen_random_uuid(),
  board text not null,
  label text not null,
  lat double precision not null,
  lng double precision not null,
  created_at timestamptz not null default now()
);
create index if not exists caravans_board_idx on public.caravans (board);

-- Kommentare (Fakt / Vermutung) ---------------------------------------------
create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  caravan_id uuid not null references public.caravans (id) on delete cascade,
  type text not null check (type in ('fakt', 'vermutung')),
  text text not null,
  author text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists comments_caravan_idx on public.comments (caravan_id);

-- Personen -------------------------------------------------------------------
create table if not exists public.persons (
  id uuid primary key default gen_random_uuid(),
  caravan_id uuid not null references public.caravans (id) on delete cascade,
  name text not null,
  age int,
  comment text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists persons_caravan_idx on public.persons (caravan_id);

-- Row Level Security ---------------------------------------------------------
alter table public.caravans enable row level security;
alter table public.comments enable row level security;
alter table public.persons enable row level security;

-- Offene Policies für den anon-Key (Zugang wird per Code/board geregelt).
drop policy if exists "caravans_all" on public.caravans;
create policy "caravans_all" on public.caravans
  for all using (true) with check (true);

drop policy if exists "comments_all" on public.comments;
create policy "comments_all" on public.comments
  for all using (true) with check (true);

drop policy if exists "persons_all" on public.persons;
create policy "persons_all" on public.persons
  for all using (true) with check (true);
