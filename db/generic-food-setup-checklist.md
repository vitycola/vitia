# Generic Foods Supabase Setup Checklist

Manual steps to apply the `generic_foods` table, RLS policies, and seed data
to your Supabase project. Each step includes a verification query.

---

## Step 1 — Apply the DDL

1. Open your Supabase project → **SQL Editor**
2. Paste the full contents of `db/generic-food-setup.sql`
3. Click **Run**

**Verify — table exists with correct shape:**
```sql
select column_name, data_type, is_nullable
from information_schema.columns
where table_name = 'generic_foods'
order by ordinal_position;
```
Expected: 12 rows (id, name, name_normalized, calories_per_100g, protein_per_100g,
carbs_per_100g, fat_per_100g, category, data_basis, source, created_at, updated_at).

**Verify — table is empty (no rows yet):**
```sql
select count(*) from generic_foods;
```
Expected: `0`

---

## Step 2 — Verify RLS is active

```sql
select tablename, rowsecurity
from pg_tables
where tablename = 'generic_foods';
```
Expected: `rowsecurity = true`

**Verify policies exist:**
```sql
select policyname, roles, cmd
from pg_policies
where tablename = 'generic_foods';
```
Expected: two rows —
- `anon read generic_foods` → roles `{anon}`, cmd `SELECT`
- `authenticated read generic_foods` → roles `{authenticated}`, cmd `SELECT`

---

## Step 3 — Verify anon SELECT works

In SQL Editor (runs as `postgres` / service role, so this verifies query syntax):
```sql
set role anon;
select count(*) from generic_foods;
reset role;
```
Expected: `0` (no error — anon read is allowed).

**Verify anon INSERT is denied:**
```sql
set role anon;
insert into generic_foods (name, name_normalized, calories_per_100g) values ('test', 'test', 0);
reset role;
```
Expected: RLS policy violation error (`new row violates row-level security policy`).

---

## Step 4 — Generate seed data

In your local terminal, run:
```bash
npm run seed:bedca
```

This fetches from `https://bedca-api.fly.dev` and writes to:
`scripts/seed-bedca/out/generic_foods_seed.sql`

Raw API responses are cached in `scripts/seed-bedca/.cache/` — re-running is
safe and will not make redundant API calls.

Review the output file before applying:
- Confirm record count is >= 100
- Spot-check a few rows for realistic macro values
- Confirm at least 8 distinct `category` values appear

---

## Step 5 — Apply seed data

1. Open Supabase SQL Editor
2. Paste the full contents of `scripts/seed-bedca/out/generic_foods_seed.sql`
3. Click **Run**

The SQL is wrapped in `BEGIN`/`COMMIT` and uses `ON CONFLICT (id) DO NOTHING` —
re-running is safe.

**Verify row count:**
```sql
select count(*) from generic_foods;
```
Expected: >= 100

**Verify source distribution:**
```sql
select source, count(*) from generic_foods group by source;
```
Expected: all rows show `source = 'bedca'`

---

## Step 6 — Verify category coverage

```sql
select category, count(*)
from generic_foods
group by category
order by count(*) desc;
```
Expected: >= 8 distinct non-null category values from the canonical set
(`vegetales`, `frutas`, `cereales_y_granos`, `legumbres`, `lacteos`, `huevos`,
`carnes`, `pescados_y_mariscos`, `fiambres_y_embutidos`, `frutos_secos`,
`bebidas`, `dulces_y_snacks`, `condimentos_y_salsas`, `otros`).

---

## Step 7 — Verify the app finds generic foods

1. Start the dev server: `npm run dev`
2. Open the food search in the app
3. Search for "pollo" — results should include items with `source: generic`
4. Search for "arroz" — confirm catalog results appear alongside OFF results

---

## Rollback

To remove the table and start over:
```sql
drop table if exists generic_foods;
```
This also drops the indexes and RLS policies automatically.
