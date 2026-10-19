"""
Extract step of the Hacendado / dry-staples seed pipeline.

Reads the Open Food Facts full dump (food.parquet) ONCE and writes a small
JSONL with only the scope rows and only the fields the curation step needs.

Scope:
  1. every product whose brand mentions "hacendado" (any tag variant), and
  2. products sold in Spain (en:spain) carrying a staple category tag
     (pasta, rice, legumes, couscous, quinoa, oats, ...), any brand.

Run (from the repo root, Python in isolated mode):
  uv run --quiet --with duckdb python -I scripts/seed-hacendado/extract.py \
      <path/to/food.parquet> <path/to/out/off-scope.jsonl>

The dump is available at
https://huggingface.co/datasets/openfoodfacts/product-database (food.parquet).
Open Food Facts data is licensed under the ODbL.
"""

import sys

import duckdb

STAPLE_TAGS = [
    "en:pastas", "en:rices", "en:legumes", "en:legumes-and-their-products",
    "en:pulses", "en:lentils", "en:chickpeas", "en:beans", "en:dried-beans",
    "en:couscous", "en:quinoa", "en:oat-flakes", "en:rolled-oats", "en:oats",
    "en:cereal-grains", "en:semolina", "en:noodles", "en:dry-pastas",
    "en:dried-legumes", "en:dried-pastas", "en:bulgur", "en:millet",
    "en:barley", "en:buckwheat",
]


def nutrient(name: str, field: str = "100g") -> str:
    return (
        "list_filter(nutriments, x -> x.name = '{n}')[1].\"{f}\"".format(n=name, f=field)
    )


def main(src: str, dst: str) -> None:
    tags = ", ".join("'%s'" % t for t in STAPLE_TAGS)
    con = duckdb.connect()
    sql = f"""
    COPY (
      SELECT
        code,
        brands,
        brands_tags,
        list_filter(product_name, x -> x.lang = 'es')[1].text AS name_es,
        list_filter(product_name, x -> x.lang = 'main')[1].text AS name_main,
        product_name[1].text AS name_first,
        categories_tags,
        countries_tags,
        stores_tags,
        quantity,
        product_quantity,
        nutrition_data_per,
        no_nutrition_data,
        obsolete,
        last_modified_t,
        completeness,
        {nutrient('energy-kcal')} AS kcal,
        {nutrient('energy-kj')} AS kj,
        {nutrient('proteins')} AS protein,
        {nutrient('carbohydrates')} AS carbs,
        {nutrient('fat')} AS fat,
        {nutrient('energy-kcal', 'prepared_100g')} AS prepared_kcal
      FROM read_parquet('{src}')
      WHERE brands ILIKE '%hacendado%'
         OR list_bool_or(list_transform(brands_tags, t -> t ILIKE '%hacendado%'))
         OR (list_contains(countries_tags, 'en:spain')
             AND list_has_any(categories_tags, [{tags}]))
    ) TO '{dst}' (FORMAT JSON)
    """
    con.execute(sql)
    n = con.execute(f"SELECT count(*) FROM read_json_auto('{dst}')").fetchone()[0]
    print(f"wrote {n} rows to {dst}")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2])
