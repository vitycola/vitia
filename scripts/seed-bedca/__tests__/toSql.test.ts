/**
 * Tests for scripts/seed-bedca/toSql.ts (task 5.7)
 *
 * Verifies:
 *   - Emitted SQL contains ON CONFLICT (id) DO NOTHING
 *   - name_normalized matches normalizeForSearch(name) for sample rows
 *   - SQL injection via single quotes in food names is escaped
 */

import { readFileSync, rmSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { generateSeedSql, type SeedRecord } from "../toSql";

// normalizeForSearch re-implemented inline (same logic as lib/search.ts).
// Kept in sync via this test: if the implementations diverge, the
// name_normalized assertion below will catch it.
function normalizeForSearch(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim();
}

// Tests pass an explicit output path so generateSeedSql never needs import.meta.
const OUTPUT_DIR = join(__dirname, "../out");
const OUTPUT_FILE = join(OUTPUT_DIR, "generic_foods_seed.sql");

beforeAll(() => {
  mkdirSync(OUTPUT_DIR, { recursive: true });
});

function readOutput(): string {
  return readFileSync(OUTPUT_FILE, "utf8");
}

describe("generateSeedSql()", () => {
  afterEach(() => {
    try {
      rmSync(OUTPUT_FILE);
    } catch {
      // File may not exist if test failed early.
    }
  });

  it("emitted SQL contains ON CONFLICT (id) DO NOTHING", () => {
    const records: SeedRecord[] = [
      {
        id: "550e8400-e29b-41d4-a716-446655440000",
        name: "Arroz blanco",
        calories_per_100g: 351,
        protein_per_100g: 6.7,
        carbs_per_100g: 78.2,
        fat_per_100g: 0.6,
        category: "cereales_y_granos",
        data_basis: "crudo",
      },
    ];

    generateSeedSql(records, OUTPUT_FILE);
    const sql = readOutput();

    expect(sql).toContain("ON CONFLICT (id) DO NOTHING");
  });

  it("name_normalized matches normalizeForSearch(name) for sample rows", () => {
    const name = "Pechuga de Pollo";
    const records: SeedRecord[] = [
      {
        id: "550e8400-e29b-41d4-a716-446655440001",
        name,
        calories_per_100g: 165,
        protein_per_100g: 31,
        carbs_per_100g: 0,
        fat_per_100g: 3.6,
        category: "carnes",
        data_basis: "crudo",
      },
    ];

    generateSeedSql(records, OUTPUT_FILE);
    const sql = readOutput();

    const expected = normalizeForSearch(name);
    expect(sql).toContain(`'${expected}'`);
  });

  it("name_normalized strips accents (Jamón → jamon)", () => {
    const name = "Jamón Ibérico";
    const records: SeedRecord[] = [
      {
        id: "550e8400-e29b-41d4-a716-446655440002",
        name,
        calories_per_100g: 375,
        protein_per_100g: 28,
        carbs_per_100g: 1,
        fat_per_100g: 28,
        category: "fiambres_y_embutidos",
        data_basis: null,
      },
    ];

    generateSeedSql(records, OUTPUT_FILE);
    const sql = readOutput();

    const expected = normalizeForSearch(name); // "jamon iberico"
    expect(sql).toContain(`'${expected}'`);
  });

  it("NULL category and data_basis are written as SQL NULL", () => {
    const records: SeedRecord[] = [
      {
        id: "550e8400-e29b-41d4-a716-446655440003",
        name: "Alimento raro",
        calories_per_100g: 100,
        protein_per_100g: 5,
        carbs_per_100g: 10,
        fat_per_100g: 3,
        category: null,
        data_basis: null,
      },
    ];

    generateSeedSql(records, OUTPUT_FILE);
    const sql = readOutput();

    expect(sql).toContain("NULL, NULL, 'bedca'");
  });

  it("single quotes in food names are escaped (SQL injection safety)", () => {
    const records: SeedRecord[] = [
      {
        id: "550e8400-e29b-41d4-a716-446655440004",
        name: "Patata O'Brien",
        calories_per_100g: 80,
        protein_per_100g: 2,
        carbs_per_100g: 18,
        fat_per_100g: 0.1,
        category: "vegetales",
        data_basis: "crudo",
      },
    ];

    generateSeedSql(records, OUTPUT_FILE);
    const sql = readOutput();

    expect(sql).toContain("Patata O''Brien");
  });

  it("wraps inserts in BEGIN/COMMIT transaction", () => {
    generateSeedSql([], OUTPUT_FILE);
    const sql = readOutput();

    expect(sql).toContain("BEGIN;");
    expect(sql).toContain("COMMIT;");
  });

  it("returns the correct record count", () => {
    const records: SeedRecord[] = [
      {
        id: "1",
        name: "A",
        calories_per_100g: 0,
        protein_per_100g: 0,
        carbs_per_100g: 0,
        fat_per_100g: 0,
        category: null,
        data_basis: null,
      },
      {
        id: "2",
        name: "B",
        calories_per_100g: 0,
        protein_per_100g: 0,
        carbs_per_100g: 0,
        fat_per_100g: 0,
        category: null,
        data_basis: null,
      },
    ];

    const count = generateSeedSql(records, OUTPUT_FILE);
    expect(count).toBe(2);
  });
});
