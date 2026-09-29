// types/aiFood.ts — AI add-flow data contracts and typed errors.

import type { MealType } from "@/types";

export type AiConfidence = "high" | "medium" | "low";

export interface AIFoodItem {
  name: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  quantity: number;
  unit: string;
  confidence: AiConfidence;
  /** Meal this item was parsed for (text flow). Undefined for photo results. */
  mealType?: MealType;
}

/** One meal's free text, sent as an independent parse request. */
export interface MealTextEntry {
  mealType: MealType;
  text: string;
}

export type ConfidenceLabel = "Alta" | "Media" | "Baja";

// ── Typed errors ──────────────────────────────────────────────────────────

/** Thrown when VITE_VITIA_AI_URL is not set at runtime. */
export class ConfigurationError extends Error {
  readonly type = "ConfigurationError" as const;
  constructor(message = "VITE_VITIA_AI_URL is not configured") {
    super(message);
    this.name = "ConfigurationError";
  }
}

/** Thrown when the user is offline (navigator.onLine === false). */
export class OfflineError extends Error {
  readonly type = "OfflineError" as const;
  constructor(message = "No internet connection") {
    super(message);
    this.name = "OfflineError";
  }
}

/** Thrown on network failure, timeout, or non-2xx HTTP response. */
export class AiServiceError extends Error {
  readonly type = "AiServiceError" as const;
  constructor(
    message = "AI service request failed",
    public readonly statusCode?: number
  ) {
    super(message);
    this.name = "AiServiceError";
  }
}
