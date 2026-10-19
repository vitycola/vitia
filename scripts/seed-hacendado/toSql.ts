/**
 * SQL rendering for generic_foods upserts. Pure string builders + a chunk writer.
 *
 * Safety: strings are single-quote doubled; control characters are removed; if a
 * string contains a backslash it is emitted as an E'' literal with backslashes
 * doubled, so the result is identical whether or not
 * standard_conforming_strings is on.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { SeedRecord } from "./curate";

export const SOURCE = "openfoodfacts";
export const CHUNK_SIZE = 300;

export function sqlStr(value: string | null): string {
  if (value === null) return "NULL";
  // biome-ignore lint/suspicious/noControlCharactersInRegex: intentional sanitising
  const clean = value.replace(/[\u0000-\u001f\u007f]/g, " ");
  const q = clean.replace(/'/g, "''");
  return clean.includes("\\") ? `E'${q.replace(/\\/g, "\\\\")}'` : `'${q}'`;
}

export function sqlNum(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "NULL";
  return String(value);
}

const COLUMNS =
  "id, name, name_normalized, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, category, data_basis, brand, cooking_factor, source";

export function valuesRow(r: SeedRecord): string {
  return `(${[
    `${sqlStr(r.id)}::uuid`,
    sqlStr(r.name),
    sqlStr(r.name_normalized),
    sqlNum(r.calories_per_100g),
    sqlNum(r.protein_per_100g),
    sqlNum(r.carbs_per_100g),
    sqlNum(r.fat_per_100g),
    sqlStr(r.category),
    sqlStr(r.data_basis),
    sqlStr(r.brand),
    sqlNum(r.cooking_factor),
    sqlStr(SOURCE),
  ].join(", ")})`;
}

export function chunkRecords<T>(items: T[], size: number = CHUNK_SIZE): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export function buildChunkSql(records: SeedRecord[], index: number, total: number): string {
  const rows = records.map(valuesRow).join(",\n");
  return [
    `-- generic_foods seed from Open Food Facts (ODbL) - chunk ${index} of ${total}, ${records.length} rows`,
    "-- Idempotent upsert keyed on the deterministic UUIDv5 id. See 00_README.md.",
    "begin;",
    `insert into generic_foods (${COLUMNS}) values`,
    rows,
    "on conflict (id) do update set",
    "  name = excluded.name,",
    "  name_normalized = excluded.name_normalized,",
    "  calories_per_100g = excluded.calories_per_100g,",
    "  protein_per_100g = excluded.protein_per_100g,",
    "  carbs_per_100g = excluded.carbs_per_100g,",
    "  fat_per_100g = excluded.fat_per_100g,",
    "  category = excluded.category,",
    "  data_basis = excluded.data_basis,",
    "  brand = excluded.brand,",
    "  cooking_factor = excluded.cooking_factor,",
    "  source = excluded.source,",
    "  updated_at = now();",
    "commit;",
    "",
  ].join("\n");
}

export function chunkFileName(index: number): string {
  return `${String(index).padStart(2, "0")}_generic_foods_off.sql`;
}

/** Writes numbered chunk files (01_..., 02_...); returns the file names. */
export function writeSqlChunks(
  records: SeedRecord[],
  outDir: string,
  size: number = CHUNK_SIZE
): string[] {
  mkdirSync(outDir, { recursive: true });
  const chunks = chunkRecords(records, size);
  return chunks.map((c, i) => {
    const name = chunkFileName(i + 1);
    writeFileSync(join(outDir, name), buildChunkSql(c, i + 1, chunks.length), "utf8");
    return name;
  });
}
