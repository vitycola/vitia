/**
 * Shared Open Food Facts proxy contract.
 *
 * This file is imported by BOTH the server function (`api/off-search.ts`)
 * and the browser client (`lib/openFoodFacts.ts`) so the response shape
 * cannot drift between them (Design D4).
 */

export interface OffProxyNutriments {
  "energy-kcal_100g"?: number;
  proteins_100g?: number;
  carbohydrates_100g?: number;
  fat_100g?: number;
}

export interface OffProxyProduct {
  code: string;
  product_name?: string;
  brands?: string | string[];
  nutriments?: OffProxyNutriments;
  serving_quantity?: number; // grams
  image_front_small_url?: string;
  image_url?: string;
  // OFF category taxonomy tags (e.g. "en:rices"). Consumed client-side by
  // categoryFromOffTags (lib/offCategoryMap.ts) and basisFromOffTags
  // (lib/offBasisMap.ts) — see design D3/D6. This proxy is a pass-through:
  // it does NOT categorize server-side.
  categories_tags?: string[];
}

/** Which upstream ultimately served the data — kept for observability. */
export type OffProxySource = "cgi" | "fallback";

export interface OffProxySuccessResponse {
  products: OffProxyProduct[];
  count: number;
  source: OffProxySource;
}

export interface OffProxyErrorResponse {
  error: string;
  source: "none";
}

export type OffProxyResponse = OffProxySuccessResponse | OffProxyErrorResponse;
