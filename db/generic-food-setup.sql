-- generic_foods DDL + RLS
-- Apply manually via Supabase SQL Editor.
-- Run verification queries from db/generic-food-setup-checklist.md after applying.

-- ── Table ─────────────────────────────────────────────────────────────────────

create table if not exists generic_foods (
  id                 uuid        not null default gen_random_uuid() primary key,
  name               text        not null,
  name_normalized    text        not null,
  calories_per_100g  real        not null check (calories_per_100g >= 0),
  protein_per_100g   real        not null default 0 check (protein_per_100g >= 0),
  carbs_per_100g     real        not null default 0 check (carbs_per_100g >= 0),
  fat_per_100g       real        not null default 0 check (fat_per_100g >= 0),
  category           text        check (
    category is null or category in (
      'vegetales', 'frutas', 'cereales_y_granos', 'legumbres', 'lacteos',
      'huevos', 'carnes', 'pescados_y_mariscos', 'fiambres_y_embutidos',
      'frutos_secos', 'bebidas', 'dulces_y_snacks', 'condimentos_y_salsas', 'otros'
    )
  ),
  data_basis         text        check (data_basis is null or data_basis in ('crudo', 'cocido')),
  source             text        not null default 'bedca',
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- ── Indexes ───────────────────────────────────────────────────────────────────

-- Trigram index for fast partial-match search on name_normalized.
-- Requires pg_trgm extension (enabled by default on Supabase).
create extension if not exists pg_trgm;
create index if not exists generic_foods_name_normalized_trgm_idx
  on generic_foods using gin (name_normalized gin_trgm_ops);

-- B-tree index on category for filtered lookups.
create index if not exists generic_foods_category_idx
  on generic_foods (category);

-- ── Row Level Security ────────────────────────────────────────────────────────

alter table generic_foods enable row level security;

-- Allow anon and authenticated roles to SELECT; no write policies (deny-by-default).
-- service_role bypasses RLS in Supabase and needs no explicit policy.

create policy "anon read generic_foods"
  on generic_foods
  for select
  to anon
  using (true);

create policy "authenticated read generic_foods"
  on generic_foods
  for select
  to authenticated
  using (true);
