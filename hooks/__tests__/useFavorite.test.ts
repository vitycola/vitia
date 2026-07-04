/** @jest-environment jsdom */
/**
 * Unit tests for useFavorite — meal-aware favorite hook for a single food.
 * Mocks db/repos/favorites so only hook behavior is under test.
 */
import { act, renderHook, waitFor } from "@testing-library/react";

jest.mock("@/db/repos/favorites", () => ({
  getMealsForFood: jest.fn(),
  setMeals: jest.fn(),
  removeAllMeals: jest.fn(),
}));

jest.mock("@/src/stores/useAuthStore", () => ({
  useAuthStore: (selector: (s: { userId: string | null }) => unknown) => selector({ userId: null }),
}));

import * as favoritesRepo from "@/db/repos/favorites";
import { useFavorite } from "../useFavorite";

const mockGetMealsForFood = favoritesRepo.getMealsForFood as jest.Mock;
const mockSetMeals = favoritesRepo.setMeals as jest.Mock;
const mockRemoveAllMeals = favoritesRepo.removeAllMeals as jest.Mock;

describe("useFavorite", () => {
  beforeEach(() => {
    mockGetMealsForFood.mockReset();
    mockSetMeals.mockReset();
    mockRemoveAllMeals.mockReset();
  });

  it("loads meals for the food on mount and derives isFavorite=false when empty", async () => {
    mockGetMealsForFood.mockResolvedValue([]);

    const { result } = renderHook(() => useFavorite("food-1"));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.isFavorite).toBe(false);
    expect(result.current.meals).toEqual([]);
  });

  it("derives isFavorite=true when at least one meal row exists", async () => {
    mockGetMealsForFood.mockResolvedValue(["lunch", "dinner"]);

    const { result } = renderHook(() => useFavorite("food-1"));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.isFavorite).toBe(true);
    expect(result.current.meals).toEqual(["lunch", "dinner"]);
  });

  it("null mealType (unassigned) also counts as favorited", async () => {
    mockGetMealsForFood.mockResolvedValue([null]);

    const { result } = renderHook(() => useFavorite("food-1"));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.isFavorite).toBe(true);
    expect(result.current.meals).toEqual([null]);
  });

  it("setMeals calls the repo with the given meal types and refreshes state", async () => {
    mockGetMealsForFood.mockResolvedValueOnce([]).mockResolvedValueOnce(["breakfast"]);
    mockSetMeals.mockResolvedValue(undefined);

    const { result } = renderHook(() => useFavorite("food-1"));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.setMeals(["breakfast"]);
    });

    expect(mockSetMeals).toHaveBeenCalledWith("food-1", null, ["breakfast"]);
    expect(result.current.meals).toEqual(["breakfast"]);
    expect(result.current.isFavorite).toBe(true);
  });

  it("remove() calls removeAllMeals with no context argument and clears local state", async () => {
    mockGetMealsForFood.mockResolvedValue(["lunch", "dinner"]);
    mockRemoveAllMeals.mockResolvedValue(undefined);

    const { result } = renderHook(() => useFavorite("food-1"));
    await waitFor(() => expect(result.current.isFavorite).toBe(true));

    await act(async () => {
      await result.current.remove();
    });

    // remove() takes no context/scope argument — whole-food removal only.
    expect(mockRemoveAllMeals).toHaveBeenCalledWith("food-1", null);
    expect(mockRemoveAllMeals).toHaveBeenCalledTimes(1);
    expect(result.current.isFavorite).toBe(false);
    expect(result.current.meals).toEqual([]);
  });

  it("does nothing and reports not favorite when foodId is null", async () => {
    const { result } = renderHook(() => useFavorite(null));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.isFavorite).toBe(false);
    expect(mockGetMealsForFood).not.toHaveBeenCalled();
  });
});
