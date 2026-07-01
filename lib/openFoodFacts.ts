import { upsert } from "@/db/repos/foods";
import type { NewFood } from "@/db/schema";

// ── OFF API constants ──────────────────────────────────────────────────
const OFF_SEARCH_BASE_URL = import.meta.env.DEV
  ? "/api/off-search"
  : "https://search.openfoodfacts.org";
const OFF_BASE_URL = import.meta.env.DEV ? "/api/off" : "https://world.openfoodfacts.org";
const OFF_SEARCH_PAGE_SIZE = 20;
const OFF_REQUEST_TIMEOUT_MS = 15000;

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
  brands?: string | string[];
  nutriments?: OffNutriments;
  serving_quantity?: number; // grams
}

interface OffCgiResponse {
  products: OffProduct[];
  count: number;
}

interface OffSearchResponse {
  hits: OffProduct[];
  count: number;
}

// ── Food with missing-data flag (for UI warning) ───────────────────────
export interface SearchResult extends NewFood {
  hasMissingData: boolean;
}

// ── Internal helpers ───────────────────────────────────────────────────

/**
 * Try CGI endpoint first (more precise results), fall back to search.openfoodfacts.org
 * if CGI returns 503/504 (common transient failures on OFF main server).
 */
async function fetchProducts(query: string): Promise<OffProduct[] | null> {
  // 1. CGI primary — more precise relevance.
  try {
    const cgiUrl = new URL(`${OFF_BASE_URL}/cgi/search.pl`, window.location.origin);
    cgiUrl.searchParams.set("search_terms", query);
    cgiUrl.searchParams.set("cc", "es");
    cgiUrl.searchParams.set("lc", "es");
    cgiUrl.searchParams.set("json", "1");
    cgiUrl.searchParams.set("page_size", String(OFF_SEARCH_PAGE_SIZE));
    cgiUrl.searchParams.set("fields", OFF_FIELDS);

    const cgiRes = await fetchWithTimeout(cgiUrl.toString(), OFF_REQUEST_TIMEOUT_MS);
    if (cgiRes.ok) {
      const data: OffCgiResponse = await cgiRes.json();
      return data.products ?? [];
    }
  } catch {
    // CGI failed — fall through to search endpoint.
  }

  // 2. Fallback — search.openfoodfacts.org (Elasticsearch, broader results).
  try {
    const searchUrl = new URL(`${OFF_SEARCH_BASE_URL}/search`, window.location.origin);
    searchUrl.searchParams.set("q", query);
    searchUrl.searchParams.set("cc", "es");
    searchUrl.searchParams.set("lc", "es");
    searchUrl.searchParams.set("page_size", String(OFF_SEARCH_PAGE_SIZE));
    searchUrl.searchParams.set("fields", OFF_FIELDS);

    const searchRes = await fetchWithTimeout(searchUrl.toString(), OFF_REQUEST_TIMEOUT_MS);
    if (searchRes.ok) {
      const data: OffSearchResponse = await searchRes.json();
      return data.hits ?? [];
    }
  } catch {
    // Both failed.
  }

  return null;
}

function fetchWithTimeout(url: string, ms: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return fetch(url, { signal: controller.signal }).finally(() => clearTimeout(timer));
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
    brand: Array.isArray(p.brands)
      ? (p.brands[0] ?? null)
      : (p.brands?.split(",")[0]?.trim() ?? null),
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
 * Search Open Food Facts with Spain locale params using the v2 API.
 * All results are normalized and upserted into the local foods cache.
 * Throws on network failure, timeout, or non-2xx HTTP status.
 */
export async function search(query: string): Promise<SearchResult[]> {
  if (!query.trim()) return [];

  const products = await fetchProducts(query);

  if (!products) {
    throw new Error("OFF search failed on both endpoints");
  }

  const results: SearchResult[] = [];

  // Normalize and upsert each valid product into the local cache.
  for (const product of products) {
    const normalized = normalizeOffProduct(product);
    if (!normalized) continue;

    const { hasMissingData, ...foodData } = normalized;
    try {
      await upsert(foodData);
    } catch {
      // Upsert failure is non-fatal — still show the result.
    }
    results.push({ ...foodData, hasMissingData });
  }

  return results;
}

/**
 * Fetch a product by barcode from OFF.
 * Phase 2: wires into the barcode scanner flow.
 * Returns null on any failure.
 */
export async function getByBarcode(barcode: string): Promise<SearchResult | null> {
  const url = `${OFF_BASE_URL}/api/v2/product/${encodeURIComponent(barcode)}.json?lc=es&cc=es&fields=${OFF_FIELDS}`;

  try {
    const response = await fetchWithTimeout(url, OFF_REQUEST_TIMEOUT_MS);

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
