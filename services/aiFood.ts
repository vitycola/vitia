import { VITIA_AI_URL } from "@/lib/env";
import { getSupabaseClient, isSyncEnabled } from "@/src/lib/supabase";
import { AiServiceError, ConfigurationError, OfflineError } from "@/types/aiFood";
import type { AIFoodItem, AiConfidence } from "@/types/aiFood";

async function getAuthToken(): Promise<string | null> {
  if (!isSyncEnabled()) return null;
  try {
    const { data } = await getSupabaseClient().auth.getSession();
    return data.session?.access_token ?? null;
  } catch {
    return null;
  }
}

const TIMEOUT_MS = 30_000;
const VALID_CONFIDENCE = new Set<string>(["high", "medium", "low"]);

function getBaseUrl(): string {
  if (!VITIA_AI_URL) throw new ConfigurationError();
  return VITIA_AI_URL;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalize(raw: Record<string, any>): AIFoodItem {
  const confidence: AiConfidence = VALID_CONFIDENCE.has(raw.confidence)
    ? (raw.confidence as AiConfidence)
    : "low";

  return {
    foodId: String(raw.foodId ?? ""),
    name: String(raw.name ?? ""),
    kcal: Number(raw.kcal ?? 0),
    protein: Number(raw.protein ?? 0),
    carbs: Number(raw.carbs ?? 0),
    fat: Number(raw.fat ?? 0),
    quantity: Number(raw.quantity ?? 0),
    unit: raw.unit ? String(raw.unit) : "g",
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = (await res.json()) as { foods: Record<string, any>[] };
    return (data.foods ?? []).map(normalize);
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
