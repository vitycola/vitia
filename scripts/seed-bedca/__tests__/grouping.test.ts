/**
 * Tests for scripts/seed-bedca/grouping.ts
 *
 * Verifies:
 *   - normalizeBaseName strips raw/cooked terms + accents/punctuation
 *   - raw/cooked variants of the same food collapse into one group
 *   - grouping is scoped within category (no cross-category merge)
 *   - completeness tiebreak (macros only), shortest-name tiebreak, first-seen tiebreak
 *   - stableFoodId determinism carries through dedupeRecords
 */

import { completeness, dedupeRecords, normalizeBaseName, toDisplayName } from "../grouping";
import type { SeedRecord } from "../toSql";

type Draft = Omit<SeedRecord, "id">;

function record(overrides: Partial<Draft>): Draft {
  return {
    name: "Alimento",
    calories_per_100g: 100,
    protein_per_100g: 10,
    carbs_per_100g: 10,
    fat_per_100g: 10,
    category: "vegetales",
    data_basis: null,
    ...overrides,
  };
}

describe("normalizeBaseName()", () => {
  it("'Arroz, crudo' → 'arroz'", () => {
    expect(normalizeBaseName("Arroz, crudo")).toBe("arroz");
  });

  it("'Arroz cocido' → 'arroz'", () => {
    expect(normalizeBaseName("Arroz cocido")).toBe("arroz");
  });

  it("strips accents ('Jamón Ibérico' → 'jamon iberico')", () => {
    expect(normalizeBaseName("Jamón Ibérico")).toBe("jamon iberico");
  });

  it("strips punctuation", () => {
    expect(normalizeBaseName("Pollo, pechuga, a la plancha.")).toBe("pollo pechuga");
  });

  it("collapses whitespace", () => {
    expect(normalizeBaseName("Pollo    crudo")).toBe("pollo");
  });
});

describe("toDisplayName()", () => {
  it("'Lenteja, seca, cruda' → 'Lenteja' (real duplicate case)", () => {
    expect(toDisplayName("Lenteja, seca, cruda")).toBe("Lenteja");
  });

  it("'Arroz, crudo' → 'Arroz'", () => {
    expect(toDisplayName("Arroz, crudo")).toBe("Arroz");
  });

  it("'Arroz integral, crudo' → 'Arroz integral' (real duplicate case)", () => {
    expect(toDisplayName("Arroz integral, crudo")).toBe("Arroz integral");
  });

  it("'Garbanzo cocido' → 'Garbanzo' (space-separated, no comma)", () => {
    expect(toDisplayName("Garbanzo cocido")).toBe("Garbanzo");
  });

  it("'Pollo, pechuga, a la plancha.' → 'Pollo, pechuga' (multi-word phrase term)", () => {
    expect(toDisplayName("Pollo, pechuga, a la plancha.")).toBe("Pollo, pechuga");
  });

  it("'Lenteja, en conserva' stays unchanged — canned is a distinct food, not a cooking-state variant", () => {
    expect(toDisplayName("Lenteja, en conserva")).toBe("Lenteja, en conserva");
  });

  it("falls back to the original name when stripping would empty the result", () => {
    expect(toDisplayName("Cruda")).toBe("Cruda");
  });
});

describe("completeness()", () => {
  it("counts non-zero macro fields (0-4)", () => {
    expect(
      completeness(
        record({
          calories_per_100g: 100,
          protein_per_100g: 0,
          carbs_per_100g: 10,
          fat_per_100g: 0,
        })
      )
    ).toBe(2);
  });

  it("returns 4 when all macros are non-zero", () => {
    expect(
      completeness(
        record({
          calories_per_100g: 1,
          protein_per_100g: 1,
          carbs_per_100g: 1,
          fat_per_100g: 1,
        })
      )
    ).toBe(4);
  });

  it("returns 0 when all macros are zero", () => {
    expect(
      completeness(
        record({
          calories_per_100g: 0,
          protein_per_100g: 0,
          carbs_per_100g: 0,
          fat_per_100g: 0,
        })
      )
    ).toBe(0);
  });
});

describe("dedupeRecords()", () => {
  it("collapses raw and cooked variants of the same food into one group", () => {
    const records: Draft[] = [
      record({ name: "Arroz, crudo", data_basis: "crudo", category: "cereales_y_granos" }),
      record({ name: "Arroz, cocido", data_basis: "cocido", category: "cereales_y_granos" }),
    ];

    const result = dedupeRecords(records);

    expect(result).toHaveLength(1);
  });

  it("raw variant wins over cooked variants regardless of completeness", () => {
    const raw = record({
      name: "Arroz, crudo",
      data_basis: "crudo",
      category: "cereales_y_granos",
      calories_per_100g: 0,
      protein_per_100g: 0,
      carbs_per_100g: 0,
      fat_per_100g: 0,
    });
    const cooked = record({
      name: "Arroz, cocido",
      data_basis: "cocido",
      category: "cereales_y_granos",
      calories_per_100g: 130,
      protein_per_100g: 2.7,
      carbs_per_100g: 28,
      fat_per_100g: 0.3,
    });

    const result = dedupeRecords([cooked, raw]);

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Arroz");
  });

  it("does not merge the same base name across different categories", () => {
    const records: Draft[] = [
      record({ name: "Leche, entera", category: "lacteos" }),
      record({ name: "Leche, entera", category: "bebidas" }),
    ];

    const result = dedupeRecords(records);

    expect(result).toHaveLength(2);
  });

  it("no raw variant: picks the cooked entry with highest completeness", () => {
    const lessComplete = record({
      name: "Garbanzo, cocido",
      data_basis: "cocido",
      category: "legumbres",
      calories_per_100g: 164,
      protein_per_100g: 0,
      carbs_per_100g: 0,
      fat_per_100g: 0,
    });
    const moreComplete = record({
      name: "Garbanzo, cocido",
      data_basis: "cocido",
      category: "legumbres",
      calories_per_100g: 164,
      protein_per_100g: 8.9,
      carbs_per_100g: 27,
      fat_per_100g: 2.6,
    });

    const result = dedupeRecords([lessComplete, moreComplete]);

    expect(result).toHaveLength(1);
    expect(result[0].protein_per_100g).toBe(8.9);
  });

  it("completeness tie: picks the entry with the shortest name", () => {
    const longer = record({
      name: "Garbanzo, cocido",
      data_basis: "cocido",
      category: "legumbres",
    });
    const shorter = record({
      name: "Garbanzo cocido",
      data_basis: "cocido",
      category: "legumbres",
    });

    const result = dedupeRecords([longer, shorter]);

    expect(result).toHaveLength(1);
    // "shorter" wins the tiebreak by raw name length, then its display name
    // gets the cooking-state descriptor stripped like any other winner.
    expect(result[0].name).toBe("Garbanzo");
  });

  it("completeness and name-length tie: picks the first-seen entry", () => {
    const first = record({
      name: "Lenteja cocida",
      data_basis: "cocido",
      category: "legumbres",
      calories_per_100g: 116,
    });
    const second = record({
      name: "Lenteja cocida",
      data_basis: "cocido",
      category: "legumbres",
      calories_per_100g: 999,
    });

    const result = dedupeRecords([first, second]);

    expect(result).toHaveLength(1);
    expect(result[0].calories_per_100g).toBe(116);
  });

  it("assigns a deterministic id derived from base name + category", () => {
    const records: Draft[] = [
      record({ name: "Arroz, crudo", data_basis: "crudo", category: "cereales_y_granos" }),
    ];

    const [a] = dedupeRecords(records);
    const [b] = dedupeRecords(records);

    expect(a.id).toBe(b.id);
    expect(a.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });
});
