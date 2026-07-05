/** @jest-environment jsdom */
/**
 * Unit tests for useCreatedFoodsList — flat "Creados" list hook.
 * Mocks db/repos/foods so only hook behavior is under test.
 */
import { act, renderHook, waitFor } from "@testing-library/react";

jest.mock("@/db/repos/foods", () => ({
  getCustomFoods: jest.fn(),
  getCompositeFoodIds: jest.fn(),
}));

import * as foodsRepo from "@/db/repos/foods";
import type { Food } from "@/db/schema";
import { normalizeForSearch } from "@/lib/search";
import { useCreatedFoodsList } from "../useCreatedFoodsList";

const mockGetCustomFoods = foodsRepo.getCustomFoods as jest.Mock;
const mockGetCompositeFoodIds = foodsRepo.getCompositeFoodIds as jest.Mock;

function makeFood(overrides: Partial<Food> = {}): Food {
  const name = overrides.name ?? "Tortilla casera";
  return {
    id: "food-1",
    name,
    brand: null,
    caloriesPer100g: 150,
    proteinPer100g: 10,
    carbsPer100g: 5,
    fatPer100g: 8,
    servingSizeG: 120,
    source: "custom",
    offProductCode: null,
    nameNormalized: normalizeForSearch(name),
    imageUrl: null,
    category: "huevos",
    createdAt: "2024-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("useCreatedFoodsList", () => {
  beforeEach(() => {
    mockGetCustomFoods.mockReset();
    mockGetCompositeFoodIds.mockReset();
    mockGetCompositeFoodIds.mockResolvedValue([]);
  });

  it("exposes compositeIds from getCompositeFoodIds()", async () => {
    mockGetCustomFoods.mockResolvedValue([makeFood({ id: "a" }), makeFood({ id: "b" })]);
    mockGetCompositeFoodIds.mockResolvedValue(["a"]);

    const { result } = renderHook(() => useCreatedFoodsList(""));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.compositeIds.has("a")).toBe(true);
    expect(result.current.compositeIds.has("b")).toBe(false);
  });

  it("loads created foods on mount, already sorted by createdAt desc from the repo", async () => {
    const newer = makeFood({ id: "a", name: "Newer", createdAt: "2024-06-01T00:00:00.000Z" });
    const older = makeFood({ id: "b", name: "Older", createdAt: "2024-01-01T00:00:00.000Z" });
    mockGetCustomFoods.mockResolvedValue([newer, older]);

    const { result } = renderHook(() => useCreatedFoodsList(""));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.items.map((f) => f.id)).toEqual(["a", "b"]);
  });

  it("filters by query, accent-insensitively", async () => {
    const jamon = makeFood({ id: "jamon", name: "Jamón casero" });
    const other = makeFood({ id: "other", name: "Puré de papas" });
    mockGetCustomFoods.mockResolvedValue([jamon, other]);

    const { result } = renderHook(() => useCreatedFoodsList("jamon"));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.items.map((f) => f.id)).toEqual(["jamon"]);
  });

  it("returns an empty items array and loading=false when there are no created foods", async () => {
    mockGetCustomFoods.mockResolvedValue([]);

    const { result } = renderHook(() => useCreatedFoodsList(""));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.items).toEqual([]);
  });

  it("refresh() re-fetches from the repo", async () => {
    mockGetCustomFoods.mockResolvedValueOnce([]).mockResolvedValueOnce([makeFood()]);

    const { result } = renderHook(() => useCreatedFoodsList(""));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.items).toEqual([]);

    await act(async () => {
      await result.current.refresh();
    });

    await waitFor(() => expect(result.current.items).toHaveLength(1));
  });
});
