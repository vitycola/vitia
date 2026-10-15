-- generic_foods: add optional brand + per-product cooking factor.
-- Apply manually via Supabase SQL Editor on EXISTING projects. Idempotent.
-- Fresh installs get the same columns from db/generic-food-setup.sql.

alter table generic_foods
  add column if not exists brand text;

-- Cooked grams per 1 raw gram for this product. Takes priority over the
-- per-category factor in lib/cookingFactors.ts. NULL = use category factor.
alter table generic_foods
  add column if not exists cooking_factor real
  check (cooking_factor is null or cooking_factor > 0);

-- Verification (run separately): expect brand (text) and cooking_factor (real), both nullable.
-- select column_name, data_type, is_nullable
-- from information_schema.columns
-- where table_name = 'generic_foods' and column_name in ('brand', 'cooking_factor');
