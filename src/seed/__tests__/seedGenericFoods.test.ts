/**
 * Tests for src/seed/seedGenericFoods.ts — the generic BEDCA-sourced foods
 * auto-seed run on every app boot.
 *
 * Mocks db/repos/foods (mirrors src/seed/__tests__/seedDemoProfile.test.ts
 * conventions: this module transitively imports db/client.ts, which uses
 * import.meta.url — Vite-only syntax ts-jest cannot parse under CommonJS).
 */

const mockGetByIds = jest.fn();
const mockUpsertMany = jest.fn();
jest.mock("@/db/repos/foods", () => ({
  getByIds: (...args: unknown[]) => mockGetByIds(...args),
  upsertMany: (...args: unknown[]) => mockUpsertMany(...args),
}));

import { canConvert } from "@/lib/cookingConversion";
import { FOOD_CATEGORIES } from "@/lib/foodCategories";
import {
  GENERIC_FOODS,
  GENERIC_FOODS_SEED_VERSION,
  seedGenericFoods,
} from "@/src/seed/seedGenericFoods";

describe("GENERIC_FOODS", () => {
  it("every entry has a valid category key", () => {
    const validKeys = new Set(Object.keys(FOOD_CATEGORIES));
    for (const food of GENERIC_FOODS) {
      expect(validKeys.has(food.category)).toBe(true);
    }
  });

  it("every entry is crudo — no separate cocido row (the toggle covers cocido logging)", () => {
    for (const food of GENERIC_FOODS) {
      expect(food.dataBasis).toBe("crudo");
    }
  });

  it("every entry's name has no crudo/cocido qualifier — it's implied", () => {
    for (const food of GENERIC_FOODS) {
      expect(food.name.toLowerCase()).not.toMatch(/crudo|cocido|hervid|plancha/);
    }
  });

  it("every entry has non-negative macro values", () => {
    for (const food of GENERIC_FOODS) {
      expect(food.caloriesPer100g).toBeGreaterThan(0);
      expect(food.proteinPer100g).toBeGreaterThanOrEqual(0);
      expect(food.carbsPer100g).toBeGreaterThanOrEqual(0);
      expect(food.fatPer100g).toBeGreaterThanOrEqual(0);
    }
  });

  it("every entry is source: custom with a unique id", () => {
    const ids = new Set<string>();
    for (const food of GENERIC_FOODS) {
      expect(food.source).toBe("custom");
      expect(ids.has(food.id)).toBe(false);
      ids.add(food.id);
    }
  });

  it("every entry actually shows the crudo/cocido conversion toggle (canConvert)", () => {
    for (const food of GENERIC_FOODS) {
      expect(canConvert(food)).toBe(true);
    }
  });

  it("each category appears exactly once — no duplicate crudo/cocido pair per food", () => {
    const categories = GENERIC_FOODS.map((food) => food.category);
    expect(new Set(categories).size).toBe(categories.length);
  });

  it("intentionally excludes legumbres (no BEDCA cocido pair passed the Atwater check)", () => {
    const categories = new Set(GENERIC_FOODS.map((food) => food.category));
    expect(categories.has("legumbres")).toBe(false);
  });
});

describe("GENERIC_FOODS_SEED_VERSION", () => {
  it("is a positive integer", () => {
    expect(Number.isInteger(GENERIC_FOODS_SEED_VERSION)).toBe(true);
    expect(GENERIC_FOODS_SEED_VERSION).toBeGreaterThan(0);
  });
});

describe("seedGenericFoods", () => {
  beforeEach(() => {
    mockGetByIds.mockReset();
    mockUpsertMany.mockReset();
  });

  it("inserts every generic food when none exist yet", async () => {
    mockGetByIds.mockResolvedValue([]);
    mockUpsertMany.mockResolvedValue([]);

    await seedGenericFoods();

    expect(mockUpsertMany).toHaveBeenCalledTimes(1);
    const inserted = mockUpsertMany.mock.calls[0][0] as Array<{ id: string }>;
    expect(inserted).toHaveLength(GENERIC_FOODS.length);
  });

  it("is idempotent: does not re-insert foods that already exist", async () => {
    mockGetByIds.mockResolvedValue(GENERIC_FOODS.map((food) => ({ id: food.id })));

    await seedGenericFoods();

    expect(mockUpsertMany).not.toHaveBeenCalled();
  });

  it("only inserts the missing subset on a partial re-run", async () => {
    const [first, ...rest] = GENERIC_FOODS;
    mockGetByIds.mockResolvedValue(rest.map((food) => ({ id: food.id })));
    mockUpsertMany.mockResolvedValue([]);

    await seedGenericFoods();

    expect(mockUpsertMany).toHaveBeenCalledTimes(1);
    const inserted = mockUpsertMany.mock.calls[0][0] as Array<{ id: string }>;
    expect(inserted).toHaveLength(1);
    expect(inserted[0].id).toBe(first.id);
  });

  it("never overwrites an existing row's fields (queries getByIds, no update call)", async () => {
    mockGetByIds.mockResolvedValue(GENERIC_FOODS.map((food) => ({ id: food.id })));

    await seedGenericFoods();

    expect(mockGetByIds).toHaveBeenCalledWith(GENERIC_FOODS.map((food) => food.id));
    expect(mockUpsertMany).not.toHaveBeenCalled();
  });

  it("never rejects, even when the repo lookup fails", async () => {
    mockGetByIds.mockRejectedValue(new Error("indexeddb unavailable"));
    jest.spyOn(console, "error").mockImplementation(() => undefined);

    await expect(seedGenericFoods()).resolves.toBeUndefined();
  });
});
