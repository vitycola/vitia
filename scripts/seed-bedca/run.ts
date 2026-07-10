/**
 * BEDCA seed pipeline orchestrator.
 *
 * Usage: npm run seed:bedca
 *
 * Steps:
 *   1. Fetch all food groups from BEDCA API
 *   2. For each group, fetch the list of foods
 *   3. For each food, fetch full macro data
 *   4. Map group → canonical category, food name → data_basis
 *   5. Generate idempotent SQL INSERT statements
 *   6. Write output to scripts/seed-bedca/out/generic_foods_seed.sql
 *
 * Raw JSON responses are cached in scripts/seed-bedca/.cache/ so the pipeline
 * can be re-run without hitting the API again.
 */

import { randomUUID } from "node:crypto";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { getFoodGroups, getFoodsInGroup, getFood, type BedcaFood } from "./fetchBedca.ts";
import { mapCategory } from "./mapCategory.ts";
import { mapBasis } from "./mapBasis.ts";
import { generateSeedSql, type SeedRecord } from "./toSql.ts";

const _dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_FILE = join(_dirname, "out", "generic_foods_seed.sql");

// ── BEDCA component IDs for macros ─────────────────────────────────────────
// Sourced from inspecting live API responses (foodresponse > food > foodvalue).
// Energy is reported in kJ (c_id 409); convert to kcal (÷ 4.184).

const C_ENERGY_KJ = "409";   // energía, total (kJ)
const C_PROTEIN   = "416";   // proteina, total (g)
const C_CARBS     = "53";    // carbohidratos (g)
const C_FAT       = "410";   // grasa, total (g)
const KJ_TO_KCAL  = 4.184;

function extractMacros(food: BedcaFood): {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
} {
  const findById = (cId: string): number => {
    const comp = food.components.find((c) => String(c.c_id) === cId);
    return comp && !Number.isNaN(comp.value) ? comp.value : 0;
  };

  return {
    calories: Math.round(findById(C_ENERGY_KJ) / KJ_TO_KCAL),
    protein:  findById(C_PROTEIN),
    carbs:    findById(C_CARBS),
    fat:      findById(C_FAT),
  };
}

async function run(): Promise<void> {
  console.log("BEDCA seed pipeline starting…");

  // Step 1: fetch groups
  console.log("\n[1/5] Fetching food groups…");
  const groups = await getFoodGroups();
  console.log(`  Found ${groups.length} groups`);

  const records: SeedRecord[] = [];
  const unmappedGroups = new Set<string>();

  // Step 2+3+4: per group, fetch foods and their macros
  for (const group of groups) {
    const groupName = group.name_es ?? group.name;
    const category = mapCategory(groupName);

    if (category === null) {
      unmappedGroups.add(groupName);
      console.warn(`  [WARN] No category mapping for group: "${groupName}" — skipping`);
      continue;
    }

    console.log(`\n[group] "${groupName}" → ${category}`);

    let foodList;
    try {
      foodList = await getFoodsInGroup(group.id);
    } catch (err) {
      console.error(`  [ERROR] Failed to fetch foods for group ${group.id}: ${err}`);
      continue;
    }

    console.log(`  ${foodList.length} foods`);

    for (const summary of foodList) {
      let food: BedcaFood | null;
      try {
        food = await getFood(summary.id);
      } catch (err) {
        console.error(`  [ERROR] Failed to fetch food ${summary.id}: ${err}`);
        continue;
      }
      if (!food) continue;

      const foodName = food.name_es ?? food.name;
      const macros = extractMacros(food);

      // Skip foods with no macro data at all (likely non-standard entries).
      if (
        macros.calories === 0 &&
        macros.protein === 0 &&
        macros.carbs === 0 &&
        macros.fat === 0
      ) {
        console.warn(`  [SKIP] No macros for "${foodName}" (id: ${food.id})`);
        continue;
      }

      const dataBasis = mapBasis(foodName);

      records.push({
        id: randomUUID(),
        name: foodName,
        calories_per_100g: macros.calories,
        protein_per_100g: macros.protein,
        carbs_per_100g: macros.carbs,
        fat_per_100g: macros.fat,
        category,
        data_basis: dataBasis,
      });
    }
  }

  // Step 5: generate SQL
  console.log(`\n[5/5] Generating SQL for ${records.length} records…`);
  const written = generateSeedSql(records, OUTPUT_FILE);

  console.log(`\nDone. ${written} records written to out/generic_foods_seed.sql`);

  if (unmappedGroups.size > 0) {
    console.warn(
      `\n[WARN] ${unmappedGroups.size} unmapped group(s) — add them to scripts/seed-bedca/mapCategory.ts:`
    );
    for (const g of unmappedGroups) {
      console.warn(`  - "${g}"`);
    }
  }
}

run().catch((err) => {
  console.error("[FATAL] Seed pipeline failed:", err);
  process.exit(1);
});
