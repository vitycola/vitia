import { upsert, upsertMany } from "@/db/repos/foods";
import type { NewFood } from "@/db/schema";
import { basisFromOffTags } from "@/lib/offBasisMap";
import { categoryFromOffTags } from "@/lib/offCategoryMap";
import type { OffProxyProduct, OffProxyResponse } from "@/lib/offTypes";

// ── OFF API constants ──────────────────────────────────────────────────
// Barcode lookup (getByBarcode) is out of scope for the same-origin proxy
// migration (spec covers `search` only) and still talks to OFF directly.
const OFF_BASE_URL = import.meta.env.DEV ? "/api/off" : "https://world.openfoodfacts.org";
const OFF_SEARCH_ENDPOINT = "/api/off-search";
const OFF_REQUEST_TIMEOUT_MS = 15000;
const OFF_SEARCH_TIMEOUT_MS = 7000; // 6-8s bound (spec: Bounded Request Timeout)

// Required fields to avoid fetching the full product blob.
const OFF_FIELDS =
  "code,product_name,brands,nutriments,serving_quantity,image_front_small_url,image_url,categories_tags";

// ── Food with missing-data flag (for UI warning) ───────────────────────
export interface SearchResult extends NewFood {
  hasMissingData: boolean;
}

// ── Internal helpers ───────────────────────────────────────────────────

function fetchWithTimeout(url: string, ms: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return fetch(url, { signal: controller.signal }).finally(() => clearTimeout(timer));
}

/**
 * Normalize a raw OFF product into the local Food shape.
 * Returns null when the product has no usable name.
 */
export function normalizeOffProduct(
  p: OffProxyProduct
): (NewFood & { hasMissingData: boolean }) | null {
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
    imageUrl: p.image_front_small_url ?? p.image_url ?? null,
    // Design D3/D6: single insertion point — both search() and
    // getByBarcode() call normalizeOffProduct, so both inherit category and
    // dataBasis resolution for free. Unmapped/unresolved tags leave these
    // null (fail-closed — never a guessed category or a guessed "crudo").
    category: categoryFromOffTags(p.categories_tags) ?? null,
    dataBasis: basisFromOffTags(p.categories_tags) ?? null,
    hasMissingData,
  };
}

// ── Public API ─────────────────────────────────────────────────────────

/**
 * Search Open Food Facts via the same-origin proxy (`/api/off-search`),
 * which owns the CGI/fallback cascade, retry/backoff, and normalization
 * server-side (spec: Same-Origin Endpoint Contract). All results are
 * normalized and batch-upserted into the local foods cache.
 *
 * An optional `signal` allows the caller (the search store) to cancel a
 * stale in-flight request when a newer query supersedes it (spec:
 * Query-Scoped Request Cancellation). When no external signal is given, a
 * 6-8s internal timeout applies (spec: Bounded Request Timeout).
 *
 * Throws on network failure, timeout, or non-2xx HTTP status — including
 * `AbortError` when the request is cancelled, which callers should
 * distinguish from other errors.
 */
export async function search(query: string, signal?: AbortSignal): Promise<SearchResult[]> {
  if (!query.trim()) return [];

  const url = new URL(OFF_SEARCH_ENDPOINT, window.location.origin);
  url.searchParams.set("q", query);

  const response = await fetch(url.toString(), {
    signal: signal ?? AbortSignal.timeout(OFF_SEARCH_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`OFF search proxy failed with status ${response.status}`);
  }

  const data: OffProxyResponse = await response.json();

  if ("error" in data) {
    throw new Error(data.error);
  }

  const normalizedByCode = new Map<string, NewFood & { hasMissingData: boolean }>();
  for (const product of data.products) {
    const normalized = normalizeOffProduct(product);
    if (!normalized) continue;
    normalizedByCode.set(normalized.id, normalized);
  }

  const foodDataList: NewFood[] = Array.from(normalizedByCode.values()).map(
    ({ hasMissingData: _hasMissingData, ...foodData }) => foodData
  );

  // Batched upsert instead of a sequential per-item await loop
  // (spec: Batched Cache Upsert). Non-fatal on write failure — still show
  // the results even if the local cache write fails.
  try {
    await upsertMany(foodDataList);
  } catch {
    // Upsert failure is non-fatal — still show the results.
  }

  return Array.from(normalizedByCode.values());
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
    const product: OffProxyProduct | undefined = data.product;
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
