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
  source: string;
  created_at: string;
  updated_at: string;
}

// ── Normalizer ───────────────────────────────────────────────────────────────

/**
 * Map a raw generic_foods row into the local NewFood shape.
 * source is always "generic"; brand, servingSizeG, offProductCode, imageUrl are null.
 */
export function normalizeGenericRow(row: GenericFoodRow): NewFood {
  return {
    id: row.id,
    name: row.name,
    brand: null,
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
  };
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Search generic_foods in Supabase via case-insensitive partial match on
 * name_normalized. Results are normalized into NewFood and batch-upserted into
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

  const dbQuery = client
    .from("generic_foods")
    .select("*")
    .ilike("name_normalized", `%${norm}%`)
    .order("name")
    .limit(25);

  const { data, error } = await (signal ? dbQuery.abortSignal(signal) : dbQuery);

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
