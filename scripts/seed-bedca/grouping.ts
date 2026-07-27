/**
 * Deduplicates raw/cooked BEDCA seed entries into one canonical row per
 * (baseName, category) group.
 *
 * See design: sdd/dedupe-bedca-seed. Groups records by a normalized base name
 * (with RAW_TERMS/COOKED_TERMS vocabulary stripped, same as mapBasis.ts) scoped
 * within category, then selects exactly one canonical record per group: the
 * raw variant if present, otherwise the most-complete cooked variant.
 */

import { COOKED_TERMS, RAW_TERMS } from "./mapBasis";
import { type SeedRecord, stableFoodId } from "./toSql";

// ── Base name normalization ─────────────────────────────────────────────────

const ALL_TERMS = [...RAW_TERMS, ...COOKED_TERMS];

// Multi-word terms (e.g. "a la plancha", "al horno") must be stripped as whole
// phrases before tokenization, since splitting on whitespace would otherwise
// leave their individual words ("a", "la", "plancha") behind. Sorted longest
// first so a longer phrase is stripped before a shorter one it contains.
const PHRASE_TERMS = ALL_TERMS.filter((term) => term.includes(" ")).sort(
  (a, b) => b.length - a.length
);

// Single-word terms are dropped per-token after splitting on whitespace.
const SINGLE_WORD_TERMS = new Set(ALL_TERMS.filter((term) => !term.includes(" ")));

/**
 * Normalizes a BEDCA food name into a base key used for grouping raw/cooked
 * variants of the same food together: NFKD-strips accents, lowercases,
 * removes punctuation, strips raw/cooked phrase terms, tokenizes on
 * whitespace, drops any remaining token that is a raw/cooked indicator term,
 * then collapses whitespace.
 */
export function normalizeBaseName(name: string): string {
  let stripped = name
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[.,;:!?()"'`]/g, " ")
    .trim();

  for (const phrase of PHRASE_TERMS) {
    stripped = stripped.split(phrase).join(" ");
  }

  const tokens = stripped
    .split(/\s+/)
    .filter((token) => token.length > 0 && !SINGLE_WORD_TERMS.has(token));

  return tokens.join(" ").trim();
}

// ── Display name cleanup ─────────────────────────────────────────────────────

const PUNCT_RE = /[.,;:!?()"'`]+$/g;

/**
 * Strips a single comma-separated segment of any raw/cooked descriptor terms
 * it contains, preserving the segment's original casing. Returns "" if the
 * whole segment (once trimmed of trailing punctuation) IS a descriptor term,
 * so the caller drops it entirely (e.g. "cruda" as its own segment).
 */
function stripTermsFromSegment(segment: string): string {
  const bare = segment.trim().replace(PUNCT_RE, "");
  if (ALL_TERMS.includes(bare.toLowerCase())) return "";

  let stripped = bare;
  for (const phrase of PHRASE_TERMS) {
    stripped = stripped.replace(
      new RegExp(`\\b${phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi"),
      " "
    );
  }

  stripped = stripped
    .split(/\s+/)
    .filter((token) => token.length > 0 && !SINGLE_WORD_TERMS.has(token.toLowerCase()))
    .join(" ");

  return stripped.trim();
}

/**
 * Produces the user-facing display name for a canonical record: strips
 * raw/cooked descriptor segments/words (e.g. ", cruda", "cocido") from the
 * BEDCA name while preserving casing and any other descriptor that isn't a
 * cooking-state term (e.g. "en conserva" stays, since canned is a distinct
 * food, not a cooking-state variant — see design). Falls back to the
 * original name if stripping would empty the result entirely.
 */
export function toDisplayName(name: string): string {
  const segments = name
    .split(",")
    .map(stripTermsFromSegment)
    .filter((segment) => segment.length > 0);

  if (segments.length === 0) return name.trim();

  const joined = segments.join(", ");
  return joined.charAt(0).toUpperCase() + joined.slice(1);
}

// ── Completeness heuristic ──────────────────────────────────────────────────

/**
 * Counts how many of the 4 macro fields (calories/protein/carbs/fat) are
 * non-zero. These are the ONLY nutrient fields that exist in this schema —
 * there are no micronutrient columns to count (see design Spec Correction 1).
 * Range: 0-4.
 */
export function completeness(record: Omit<SeedRecord, "id">): number {
  let count = 0;
  if (record.calories_per_100g > 0) count++;
  if (record.protein_per_100g > 0) count++;
  if (record.carbs_per_100g > 0) count++;
  if (record.fat_per_100g > 0) count++;
  return count;
}

// ── Grouping + canonical selection ──────────────────────────────────────────

function groupKey(baseName: string, category: string | null): string {
  return `${baseName}\0${category ?? ""}`;
}

/**
 * Compares two candidate records within a group and returns the one that
 * should win, using the ordered tiebreak rules:
 *   1. raw (data_basis === "crudo") wins outright
 *   2. higher completeness()
 *   3. shorter name.length
 *   4. first-seen (original array index) — `a` wins ties since it was seen first
 */
function pickWinner(
  a: { record: Omit<SeedRecord, "id">; index: number },
  b: { record: Omit<SeedRecord, "id">; index: number }
): { record: Omit<SeedRecord, "id">; index: number } {
  const aRaw = a.record.data_basis === "crudo";
  const bRaw = b.record.data_basis === "crudo";
  if (aRaw !== bRaw) return aRaw ? a : b;

  const aCompleteness = completeness(a.record);
  const bCompleteness = completeness(b.record);
  if (aCompleteness !== bCompleteness) return aCompleteness > bCompleteness ? a : b;

  const aLen = a.record.name.length;
  const bLen = b.record.name.length;
  if (aLen !== bLen) return aLen < bLen ? a : b;

  return a.index <= b.index ? a : b;
}

/**
 * Groups records by normalized base name scoped within category, selects one
 * canonical record per group, and assigns each winner a deterministic,
 * content-derived id via stableFoodId(baseName, category).
 */
export function dedupeRecords(records: Omit<SeedRecord, "id">[]): SeedRecord[] {
  const groups = new Map<
    string,
    { baseName: string; winner: { record: Omit<SeedRecord, "id">; index: number } }
  >();

  records.forEach((record, index) => {
    const baseName = normalizeBaseName(record.name);
    const key = groupKey(baseName, record.category);
    const candidate = { record, index };

    const existing = groups.get(key);
    if (!existing) {
      groups.set(key, { baseName, winner: candidate });
    } else {
      groups.set(key, { baseName, winner: pickWinner(existing.winner, candidate) });
    }
  });

  return Array.from(groups.values()).map(({ baseName, winner }) => ({
    ...winner.record,
    name: toDisplayName(winner.record.name),
    id: stableFoodId(baseName, winner.record.category),
  }));
}
