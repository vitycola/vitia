/**
 * Hacendado / dry-staples seed pipeline (curate + SQL step).
 *
 * Usage:
 *   1. python extract step (see extract.py) -> off-scope.jsonl
 *   2. npm run seed:hacendado -- <path/to/off-scope.jsonl>
 *      (or set OFF_SCOPE_JSONL; default scripts/seed-hacendado/.cache/off-scope.jsonl)
 *
 * Writes db/seed/hacendado/NN_generic_foods_off.sql, REVIEW.md and review.csv.
 * 00_README.md is hand-written and not touched.
 */

import { readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { type Exclusion, type OffRow, type SeedRecord, curateRow, dedupe } from "./curate";
import { loadStapleFactors } from "./factors";
import { buildReviewCsv, buildReviewMd } from "./report";
import { writeSqlChunks } from "./toSql";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "../..");
const OUT_DIR = join(repoRoot, "db/seed/hacendado");
const FACTORS_FILE = join(here, "staple-factors.json");

function main(): void {
  const input =
    process.argv[2] ?? process.env.OFF_SCOPE_JSONL ?? join(here, ".cache/off-scope.jsonl");
  const factors = loadStapleFactors(FACTORS_FILE);
  const lines = readFileSync(input, "utf8")
    .split("\n")
    .filter((l) => l.trim() !== "");

  const exclusions: Exclusion[] = [];
  const candidates: SeedRecord[] = [];
  for (const line of lines) {
    const res = curateRow(JSON.parse(line) as OffRow, factors);
    if (res.kind === "kept") candidates.push(res.record);
    else exclusions.push(res.exclusion);
  }
  const { kept, dropped } = dedupe(candidates);

  // Remove stale chunk files so a smaller rerun leaves no orphans.
  for (const f of readdirSync(OUT_DIR)) {
    if (/^\d{2}_generic_foods_off\.sql$/.test(f) && f !== "00_README.md") rmSync(join(OUT_DIR, f));
  }
  const files = writeSqlChunks(kept, OUT_DIR);
  const stats = {
    extracted: lines.length,
    exclusions,
    duplicates: dropped,
    kept,
    factors,
    factorsFileFound: existsSync(FACTORS_FILE),
  };
  writeFileSync(join(OUT_DIR, "REVIEW.md"), buildReviewMd(stats), "utf8");
  writeFileSync(join(OUT_DIR, "review.csv"), buildReviewCsv(stats), "utf8");
  console.log(
    `extracted=${lines.length} kept=${kept.length} excluded=${exclusions.length} duplicates=${dropped.length} chunks=${files.length}`
  );
}

main();
