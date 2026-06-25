import { upsert } from "@/db/repositories/foods";
import type { NewFood } from "@/db/schema";

// ── OFF API constants ──────────────────────────────────────────────────
const OFF_BASE_URL = "https://world.openfoodfacts.org";
const OFF_SEARCH_PAGE_SIZE = 20;
const OFF_REQUEST_TIMEOUT_MS = 4000;
const OFF_USER_AGENT = "Vitia/1.0 (personal nutrition tracker; https://github.com/vitycola/vitia)";

// Required fields to avoid fetching the full product blob.
const OFF_FIELDS = "code,product_name,brands,nutriments,serving_quantity";

// ── OFF response types ─────────────────────────────────────────────────
interface OffNutriments {
  "energy-kcal_100g"?: number;
  proteins_100g?: number;
  carbohydrates_100g?: number;
  fat_100g?: number;
}

interface OffProduct {
  code: string;
  product_name?: string;
  brands?: string;
  nutriments?: OffNutriments;
  serving_quantity?: number; // grams
}

interface OffSearchResponse {
  products: OffProduct[];
  count: number;
}

// ── Food with missing-data flag (for UI warning) ───────────────────────
export interface SearchResult extends NewFood {
  hasMissingData: boolean;
}

// ── Internal helpers ───────────────────────────────────────────────────

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("Request timed out")), ms)
  );
  return Promise.race([promise, timeout]);
}

/**
 * Normalize a raw OFF product into the local Food shape.
 * Returns null when the product has no usable name.
 */
export function normalizeOffProduct(p: OffProduct): (NewFood & { hasMissingData: boolean }) | null {
  const name = p.product_name?.trim();
  if (!name) return null;

  const n = p.nutriments ?? {};
  const caloriesPer100g = n["energy-kcal_100g"] ?? 0;
  const proteinPer100g = n.proteins_100g ?? 0;
  const carbsPer100g = n.carbohydrates_100g ?? 0;
  const fatPer100g = n.fat_100g ?? 0;

  const hasMissingData =
    caloriesPer100g === 0 && proteinPer100g === 0 && carbsPer100g === 0 && fatPer100g === 0;

  return {
    id: p.code,
    name,
    brand: p.brands?.split(",")[0]?.trim() ?? null,
    caloriesPer100g,
    proteinPer100g,
    carbsPer100g,
    fatPer100g,
    servingSizeG: p.serving_quantity ?? null,
    source: "openfoodfacts",
    offProductCode: p.code,
    hasMissingData,
  };
}

// ── Public API ─────────────────────────────────────────────────────────

/**
 * Search Open Food Facts with Spain locale params.
 * All results are normalized and upserted into the local foods cache.
 * On network failure or timeout, returns an empty array (never throws).
 */
export async function search(query: string): Promise<SearchResult[]> {
  if (!query.trim()) return [];

  const url = new URL(`${OFF_BASE_URL}/cgi/search.pl`);
  url.searchParams.set("search_terms", query);
  url.searchParams.set("cc", "es");
  url.searchParams.set("lc", "es");
  url.searchParams.set("json", "1");
  url.searchParams.set("page_size", String(OFF_SEARCH_PAGE_SIZE));
  url.searchParams.set("fields", OFF_FIELDS);

  try {
    const response = await withTimeout(
      fetch(url.toString(), {
        headers: { "User-Agent": OFF_USER_AGENT },
      }),
      OFF_REQUEST_TIMEOUT_MS
    );

    if (!response.ok) return [];

    const data: OffSearchResponse = await response.json();
    const products = data.products ?? [];

    const results: SearchResult[] = [];

    // Normalize and upsert each valid product into the local cache.
    for (const product of products) {
      const normalized = normalizeOffProduct(product);
      if (!normalized) continue;

      try {
        const { hasMissingData, ...foodData } = normalized;
        await upsert(foodData);
        results.push({ ...foodData, hasMissingData });
      } catch {
        // If a single upsert fails, keep going with the rest.
      }
    }

    return results;
  } catch {
    // Network failure, timeout, or JSON parse error — return empty array.
    return [];
  }
}

/**
 * Fetch a product by barcode from OFF.
 * Phase 2: wires into the barcode scanner flow.
 * Returns null on any failure.
 */
export async function getByBarcode(barcode: string): Promise<SearchResult | null> {
  const url = `${OFF_BASE_URL}/api/v2/product/${encodeURIComponent(barcode)}.json?lc=es&cc=es&fields=${OFF_FIELDS}`;

  try {
    const response = await withTimeout(
      fetch(url, { headers: { "User-Agent": OFF_USER_AGENT } }),
      OFF_REQUEST_TIMEOUT_MS
    );

    if (!response.ok) return null;

    const data = await response.json();
    const product: OffProduct | undefined = data.product;
    if (!product) return null;

    const normalized = normalizeOffProduct(product);
    if (!normalized) return null;

    try {
      const { hasMissingData, ...foodData } = normalized;
      await upsert(foodData);
      return { ...foodData, hasMissingData };
    } catch {
      return null;
    }
  } catch {
    return null;
  }
}
