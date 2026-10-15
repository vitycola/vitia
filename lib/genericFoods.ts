import { upsertMany } from "@/db/repos/foods";
import type { NewFood } from "@/db/schema";
import { normalizeForSearch } from "@/lib/search";
import { getSupabasePublicClient } from "@/src/lib/supabase";

// ── Row shape as returned by Supabase (snake_case mirrors SQL columns) ──────

export interface GenericFoodRow {
  id: string;
  name: string;
  name_normalized: string;
  calories_per_100g: number;
  protein_per_100g: number;
  carbs_per_100g: number;
  fat_per_100g: number;
  category: string | null;
  data_basis: "crudo" | "cocido" | null;
  /** Optional: absent on rows/schemas that predate generic-food-brand-migration.sql. */
  brand?: string | null;
  /** Optional: cooked grams per raw gram for this product (> 0). */
  cooking_factor?: number | null;
  source: string;
  created_at: string;
  updated_at: string;
}

// ── Normalizer ───────────────────────────────────────────────────────────────

/**
 * Map a raw generic_foods row into the local NewFood shape.
 * source is always "generic"; servingSizeG, offProductCode, imageUrl are null.
 * brand and cookingFactor are carried through when present (null otherwise).
 */
export function normalizeGenericRow(row: GenericFoodRow): NewFood {
  return {
    id: row.id,
    name: row.name,
    brand: row.brand?.trim() || null,
    caloriesPer100g: row.calories_per_100g,
    proteinPer100g: row.protein_per_100g,
    carbsPer100g: row.carbs_per_100g,
    fatPer100g: row.fat_per_100g,
    servingSizeG: null,
    source: "generic",
    offProductCode: null,
    nameNormalized: row.name_normalized,
    imageUrl: null,
    category: row.category,
    dataBasis: row.data_basis,
    cookingFactor:
      typeof row.cooking_factor === "number" &&
      Number.isFinite(row.cooking_factor) &&
      row.cooking_factor > 0
        ? row.cooking_factor
        : null,
  };
}

/**
 * True only for an "undefined column" error caused by the missing `brand`
 * column: Postgres 42703 (what PostgREST forwards for an unknown column in a
 * filter), or PGRST204 (PostgREST schema-cache miss) — each only when the
 * message names brand in "column ... does not exist" / "could not find" form.
 */
function isMissingBrandColumn(error: { code?: string; message?: string }): boolean {
  const message = error.message ?? "";
  if (error.code === "42703") return /\bbrand\b/i.test(message) || message === "";
  if (error.code === "PGRST204") return /could not find the 'brand' column/i.test(message);
  return false;
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Search generic_foods in Supabase via case-insensitive partial match on
 * name_normalized or brand. Results are normalized into NewFood and batch-upserted into
 * the local cache.
 *
 * Non-fatal: any error (network, missing env, RLS) causes the function to
 * reject — callers (useFoodSearchStore) catch and isolate the failure so
 * local + OFF results remain visible.
 *
 * An optional AbortSignal allows the search store to cancel stale in-flight
 * requests (same pattern as lib/openFoodFacts.ts).
 */
export async function search(query: string, signal?: AbortSignal): Promise<NewFood[]> {
  if (!query.trim()) return [];

  const norm = normalizeForSearch(query);

  const client = getSupabasePublicClient();

  // Only plain letters/digits/spaces are interpolated into the PostgREST
  // `or()` filter string (commas, parentheses, dots and wildcards would change
  // its structure). Anything else falls back to the name-only ilike, which
  // passes the value as a single parameter.
  const brandSafe = /^[\p{L}\p{N} ]+$/u.test(norm);

  const run = async (matchBrand: boolean) => {
    const base = client.from("generic_foods").select("*");
    const filtered = matchBrand
      ? base.or(`name_normalized.ilike.%${norm}%,brand.ilike.%${norm}%`)
      : base.ilike("name_normalized", `%${norm}%`);
    const dbQuery = filtered.order("name").limit(25);
    return signal ? dbQuery.abortSignal(signal) : dbQuery;
  };

  let { data, error } = await run(brandSafe);

  // Deployed before generic-food-brand-migration.sql: the `brand` column does
  // not exist yet (Postgres 42703). Retry matching by name only.
  if (error && brandSafe && isMissingBrandColumn(error)) {
    ({ data, error } = await run(false));
  }

  if (signal?.aborted) {
    throw new DOMException("Aborted", "AbortError");
  }

  if (error) {
    throw new Error(`[genericFoods] Supabase query failed: ${error.message}`);
  }

  const rows = (data as GenericFoodRow[]) ?? [];
  const normalized = rows.map(normalizeGenericRow);

  // Batch-upsert into local cache (non-fatal on write failure).
  try {
    await upsertMany(normalized);
  } catch {
    // Cache write failure is non-fatal — still return results.
  }

  return normalized;
}
