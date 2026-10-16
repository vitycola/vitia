/**
 * Row-level curation: one extracted OFF row -> kept record or exclusion.
 * Pure (no IO). Dedup is a separate pass over kept records.
 */

import { normalizeForSearch } from "../../lib/search";
import { resolveCategory } from "./category";
import { HACENDADO, brandVariantsFor, canonicalBrand, cleanName } from "./cleanName";
import { type StapleFactors, applyFactor } from "./factors";
import { checkMacros } from "./macros";
import { foldName, isPlainDurumPasta, isPowderBeverage } from "./nameRules";
import { offProductId } from "./offId";
import { type Basis, type StapleRule, determineBasis, nameStapleFamily } from "./staples";

export interface OffRow {
  code: string;
  brands: string | null;
  brands_tags: string[] | null;
  stores_tags?: string[] | null;
  name_es: string | null;
  name_main: string | null;
  name_first: string | null;
  categories_tags: string[] | null;
  countries_tags: string[] | null;
  nutrition_data_per: string | null;
  no_nutrition_data: boolean | null;
  obsolete: boolean | null;
  last_modified_t: number | null;
  completeness: number | null;
  kcal: number | null;
  kj: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
}

export interface SeedRecord {
  code: string;
  id: string;
  name: string;
  name_normalized: string;
  brand: string | null;
  calories_per_100g: number;
  protein_per_100g: number;
  carbs_per_100g: number;
  fat_per_100g: number;
  category: string | null;
  data_basis: Basis | null;
  cooking_factor: number | null;
  staple_rule: StapleRule | null;
  basis_reason: string;
  hacendado: boolean;
  completeness: number;
  last_modified_t: number;
}

export type Exclusion = {
  code: string;
  reason: string;
  name: string;
  kcal: number | null;
  detail?: string;
};

export type CurateResult =
  | { kind: "kept"; record: SeedRecord }
  | { kind: "excluded"; exclusion: Exclusion };

/** Real foods with 3 or fewer letters; every other very short name is dropped as noise. */
const SHORT_NAME_OK = new Set(["sal", "pan", "ajo", "te", "ron", "uva"]);

export function pickName(row: OffRow): string | null {
  return row.name_es?.trim() || row.name_main?.trim() || row.name_first?.trim() || null;
}

export function curateRow(row: OffRow, factors: StapleFactors): CurateResult {
  const rawName = pickName(row) ?? "";
  const ex = (reason: string, detail?: string): CurateResult => ({
    kind: "excluded",
    exclusion: { code: row.code, reason, name: rawName, kcal: row.kcal, detail },
  });

  if (row.obsolete) return ex("obsolete");
  if (row.no_nutrition_data) return ex("no_nutrition_data");

  const tags = row.categories_tags ?? [];

  // Per-serving rows are only usable when real 100 g values exist (kcal present).
  const macros = checkMacros({
    kcal: row.kcal,
    kj: row.kj,
    protein: row.protein,
    carbs: row.carbs,
    fat: row.fat,
  });
  if (!macros.ok) return ex(macros.reason);

  const brand = canonicalBrand(row.brands, row.brands_tags ?? [], row.stores_tags ?? []);
  const hacendado = brand === HACENDADO;
  const name = cleanName(pickName(row), brandVariantsFor(row.brands, brand));
  if (!name) return ex("no_name");
  const letters = (name.match(/\p{L}/gu) ?? []).length;
  if (letters <= 3 && !SHORT_NAME_OK.has(foldName(name))) return ex("name_too_short");

  const kcal = macros.macros.calories;
  if (isPowderBeverage(name, tags, kcal)) return ex("powder_beverage_per_100g");

  const nameFamily = tags.length === 0 ? nameStapleFamily(name) : null;
  const category = resolveCategory(tags, { nameFamily, name, kcal });
  const b = determineBasis({ tags, kcal, category, nameFamily, name });

  // Scope: all Hacendado rows; other brands only when a dry staple is confirmed.
  if (!hacendado && b.basis !== "crudo") {
    return ex(
      b.candidateFamily ? "non_hacendado_staple_not_confirmed_dry" : "out_of_scope",
      b.reason
    );
  }

  // The pasta factor is only defensible for plain durum-wheat dry pasta.
  const factorRule =
    b.stapleRule === "pasta_dry" && !isPlainDurumPasta(tags, name) ? null : b.stapleRule;

  return {
    kind: "kept",
    record: {
      code: row.code,
      id: offProductId(row.code),
      name,
      name_normalized: normalizeForSearch(name),
      brand,
      calories_per_100g: macros.macros.calories,
      protein_per_100g: macros.macros.protein,
      carbs_per_100g: macros.macros.carbs,
      fat_per_100g: macros.macros.fat,
      category,
      data_basis: b.basis,
      cooking_factor: applyFactor(factors, b.basis, factorRule),
      staple_rule: b.stapleRule,
      basis_reason: b.reason,
      hacendado,
      completeness: row.completeness ?? 0,
      last_modified_t: row.last_modified_t ?? 0,
    },
  };
}

/**
 * Dedup key: folded name with number markers unified ("nº 3", "n°3", "no 3",
 * "N3" -> "n3") plus brand. Punctuation and accents never matter.
 */
export function dedupeKey(r: Pick<SeedRecord, "name" | "brand">): string {
  const n = foldName(r.name).replace(/\b(?:n|no|num|numero)\s*(\d+)\b/g, "n$1");
  return `${n}|${(r.brand ?? "").toLowerCase()}`;
}

/** Two rows are the same product form when basis matches and kcal is within 25%. */
export function sameForm(a: SeedRecord, b: SeedRecord): boolean {
  if (a.data_basis !== b.data_basis) return false;
  const hi = Math.max(a.calories_per_100g, b.calories_per_100g);
  return hi === 0 || Math.abs(a.calories_per_100g - b.calories_per_100g) <= 0.25 * hi;
}

function betterRecord(a: SeedRecord, b: SeedRecord): number {
  if (a.completeness !== b.completeness) return b.completeness - a.completeness;
  if (a.last_modified_t !== b.last_modified_t) return b.last_modified_t - a.last_modified_t;
  return a.code < b.code ? -1 : a.code > b.code ? 1 : 0;
}

/**
 * Deterministic dedup. Rows sharing a dedupe key collapse only when they are
 * the same product form (same data_basis, kcal within 25%); the survivor is the
 * most complete, then most recently modified, then smallest code. Different
 * forms are all kept and their display names are disambiguated with a suffix
 * (see disambiguate), then name_normalized is recomputed from the FINAL name.
 */
export function dedupe(records: SeedRecord[]): { kept: SeedRecord[]; dropped: SeedRecord[] } {
  const groups = new Map<string, SeedRecord[]>();
  for (const r of records) {
    const k = dedupeKey(r);
    const g = groups.get(k);
    if (g) g.push(r);
    else groups.set(k, [r]);
  }
  const kept: SeedRecord[] = [];
  const dropped: SeedRecord[] = [];
  for (const g of groups.values()) {
    const clusters: SeedRecord[] = [];
    for (const r of [...g].sort(betterRecord)) {
      if (clusters.some((c) => sameForm(c, r))) dropped.push(r);
      else clusters.push(r);
    }
    kept.push(...(clusters.length > 1 ? disambiguate(clusters) : clusters));
  }
  kept.sort(
    (a, b) =>
      Number(b.hacendado) - Number(a.hacendado) ||
      (a.name_normalized < b.name_normalized
        ? -1
        : a.name_normalized > b.name_normalized
          ? 1
          : 0) ||
      (a.code < b.code ? -1 : 1)
  );
  return { kept, dropped };
}

/** Readable, deterministic suffixes for rows that collide on (name, brand). */
export function disambiguate(rows: SeedRecord[]): SeedRecord[] {
  const basisLabel = (r: SeedRecord): string =>
    r.data_basis === "crudo" ? "en seco" : r.data_basis === "cocido" ? "cocido" : "";
  const first = rows.map((r) => basisLabel(r) || `${r.calories_per_100g} kcal`);
  const counts = new Map<string, number>();
  for (const l of first) counts.set(l, (counts.get(l) ?? 0) + 1);
  return rows.map((r, i) => {
    const label =
      (counts.get(first[i]) ?? 0) > 1
        ? [basisLabel(r), `${r.calories_per_100g} kcal`].filter(Boolean).join(", ")
        : first[i];
    const name = `${r.name} (${label})`;
    return { ...r, name, name_normalized: normalizeForSearch(name) };
  });
}
