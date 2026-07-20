import { VITIA_AI_URL } from "@/lib/env";
import { getSupabaseAuthClient } from "@/src/lib/supabase";
import { AiServiceError, ConfigurationError, OfflineError } from "@/types/aiFood";
import type { AIFoodItem, AiConfidence } from "@/types/aiFood";

async function getAuthToken(): Promise<string | null> {
  try {
    const { data } = await getSupabaseAuthClient().auth.getSession();
    return data.session?.access_token ?? null;
  } catch {
    return null;
  }
}

const TIMEOUT_MS = 30_000;

function getBaseUrl(): string {
  if (!VITIA_AI_URL) throw new ConfigurationError();
  return VITIA_AI_URL;
}

type RawMatchedFood = {
  query_name?: string;
  matched_name?: string;
  grams?: number;
  source?: string;
  low_confidence?: boolean;
  macros_actual?: Record<string, number>;
};

function normalize(raw: RawMatchedFood): AIFoodItem {
  const macros = raw.macros_actual ?? {};
  const confidence: AiConfidence = raw.low_confidence
    ? "low"
    : raw.source === "unmatched"
      ? "low"
      : "high";

  return {
    foodId: String(raw.matched_name ?? raw.query_name ?? ""),
    name: String(raw.matched_name ?? raw.query_name ?? ""),
    kcal: Number(macros.calories ?? 0),
    protein: Number(macros.protein ?? 0),
    carbs: Number(macros.carbs ?? 0),
    fat: Number(macros.fat ?? 0),
    quantity: Number(raw.grams ?? 0),
    unit: "g",
    confidence,
  };
}

async function request(url: string, init: RequestInit): Promise<AIFoodItem[]> {
  if (navigator.onLine === false) throw new OfflineError();

  const token = await getAuthToken();
  const authHeaders: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  const mergedInit: RequestInit = {
    ...init,
    headers: { ...(init.headers as Record<string, string> | undefined), ...authHeaders },
    signal: controller.signal,
  };

  try {
    const res = await fetch(url, mergedInit);
    if (!res.ok) throw new AiServiceError(`HTTP ${res.status}`, res.status);
    const data = (await res.json()) as { items: RawMatchedFood[] };
    return (data.items ?? []).map(normalize);
  } catch (err) {
    if (
      err instanceof ConfigurationError ||
      err instanceof OfflineError ||
      err instanceof AiServiceError
    ) {
      throw err;
    }
    throw new AiServiceError(err instanceof Error ? err.message : "Unknown error");
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Send a photo to the vitia-ai backend for food recognition.
 * Returns normalized AIFoodItem array.
 */
export async function analyzePhoto(file: File): Promise<AIFoodItem[]> {
  const base = getBaseUrl();
  const body = new FormData();
  body.append("image", file);
  return request(`${base}/api/analyze`, { method: "POST", body });
}

/**
 * Send a free-text food description to the vitia-ai backend for parsing.
 * Returns normalized AIFoodItem array.
 */
export async function parseText(text: string): Promise<AIFoodItem[]> {
  const base = getBaseUrl();
  return request(`${base}/api/parse`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
}
