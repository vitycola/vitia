/**
 * Optional per-rule cooking factors (cooked grams per raw gram).
 *
 * File shape (scripts/seed-hacendado/staple-factors.json):
 *   { "<rule-key>": { "factor": number, "source": "..." } }
 * A missing file means "no factors": every cooking_factor is NULL. Factors are
 * NEVER invented in code. A factor is applied only to rows whose data_basis is
 * "crudo" AND whose staple rule key matches (see applyFactor).
 */

import { existsSync, readFileSync } from "node:fs";
import type { Basis, StapleRule } from "./staples";

export type StapleFactors = Record<string, { factor: number; source: string }>;

export function parseStapleFactors(json: string): StapleFactors {
  const raw = JSON.parse(json) as Record<string, { factor?: unknown; source?: unknown }>;
  const out: StapleFactors = {};
  for (const [key, v] of Object.entries(raw)) {
    if (!v || typeof v.factor !== "number" || !Number.isFinite(v.factor) || v.factor <= 0) {
      throw new Error(`staple-factors: invalid factor for "${key}"`);
    }
    out[key] = { factor: v.factor, source: typeof v.source === "string" ? v.source : "" };
  }
  return out;
}

export function loadStapleFactors(path: string): StapleFactors {
  if (!existsSync(path)) return {};
  return parseStapleFactors(readFileSync(path, "utf8"));
}

export function applyFactor(
  factors: StapleFactors,
  basis: Basis | null,
  rule: StapleRule | null
): number | null {
  if (basis !== "crudo" || rule === null) return null;
  return factors[rule]?.factor ?? null;
}
