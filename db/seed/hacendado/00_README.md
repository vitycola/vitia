# Open Food Facts seed: Hacendado + dry staples

Upserts curated Open Food Facts (OFF) products into `generic_foods` (`source = 'openfoodfacts'`):

1. every Hacendado (Mercadona store brand) product that passes the quality rules, and
2. dry staples of any brand sold in Spain (pasta, rice, dry legumes, couscous/quinoa/oats-type grains).

Nothing in this folder has been executed against any database. Review `REVIEW.md` and `review.csv` first.

## Run order

1. Make sure the schema is current (`db/generic-food-setup.sql`, including the `brand` and `cooking_factor` columns).
2. In the Supabase SQL Editor run `01_generic_foods_off.sql`, `02_...`, up to the last numbered file, in order.
   Each file (at most 300 rows) is wrapped in its own transaction and is valid on its own.
3. The files are idempotent: ids are UUIDv5 of the OFF barcode, and every insert is
   `on conflict (id) do update`, so re-running refreshes the same rows and never duplicates them.

## Verification queries

```sql
select count(*) from generic_foods where source = 'openfoodfacts';

select brand, count(*) from generic_foods
where source = 'openfoodfacts' group by brand order by 2 desc limit 20;

select coalesce(category, 'NULL') as category, count(*) from generic_foods
where source = 'openfoodfacts' group by 1 order by 2 desc;

select coalesce(data_basis, 'NULL') as data_basis, count(*) from generic_foods
where source = 'openfoodfacts' group by 1 order by 2 desc;

-- raw staples that should show the raw/cooked toggle
select name, brand, category, data_basis, cooking_factor from generic_foods
where source = 'openfoodfacts' and data_basis = 'crudo' order by name limit 50;
```

## Rollback

```sql
delete from generic_foods where source = 'openfoodfacts';
```

To remove only this seed's brands, add `and brand = 'Hacendado'`. Other brands in this seed are dry staples.
This is a destructive statement: run the verification count first and only run it deliberately.

## Regenerating

```sh
# 1. Extract the scope from the OFF dump (food.parquet, one pass, a few minutes)
uv run --quiet --with duckdb python -I scripts/seed-hacendado/extract.py <food.parquet> <off-scope.jsonl>
# 2. Curate and write SQL, REVIEW.md and review.csv into db/seed/hacendado/
npm run seed:hacendado -- <off-scope.jsonl>
```

Cooking factors come from `scripts/seed-hacendado/staple-factors.json` (optional; missing means NULL).
A factor is applied only to rows with `data_basis = 'crudo'` and a matching staple rule key.

## Attribution (ODbL)

This data is derived from [Open Food Facts](https://world.openfoodfacts.org), made available under the
[Open Database License (ODbL) 1.0](https://opendatacommons.org/licenses/odbl/1-0/). Individual contents are
under the Database Contents License. Credit: Open Food Facts contributors. Any derived database you publish
must carry the same attribution and be shared under the same license (share-alike).
