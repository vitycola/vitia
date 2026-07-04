/**
 * Data + view-model hook for the Favorites browsing tab.
 * Loads all favorite rows for the user, batch-resolves the underlying foods,
 * groups them by fixed meal order + an "unassigned" bucket, and supports a
 * client-side name filter plus optimistic whole-food removal.
 */

import * as favoritesRepo from "@/db/repos/favorites";
import * as foodsRepo from "@/db/repos/foods";
import type { Food } from "@/db/schema";
import { MEAL_ORDER } from "@/lib/constants";
import { normalizeForSearch } from "@/lib/search";
import { useAuthStore } from "@/src/stores/useAuthStore";
import type { MealType } from "@/types";
import { useCallback, useEffect, useMemo, useState } from "react";

export interface FavoriteListItem extends Food {
  /** Other meal types (besides the section this item is rendered in) this food is also favorited under. */
  otherMeals: MealType[];
}

export interface FavoriteSection {
  mealType: MealType | null;
  items: FavoriteListItem[];
}

export interface UseFavoritesListResult {
  sections: FavoriteSection[];
  loading: boolean;
  query: string;
  setQuery: (q: string) => void;
  /** Optimistically removes a food from every section, then persists. */
  remove: (foodId: string) => Promise<void>;
  refresh: () => Promise<void>;
}

export function useFavoritesList(): UseFavoritesListResult {
  const userId = useAuthStore((s) => s.userId);
  const [rows, setRows] = useState<Array<{ foodId: string; mealType: MealType | null }>>([]);
  const [foodsById, setFoodsById] = useState<Map<string, Food>>(new Map());
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const favoriteRows = await favoritesRepo.listWithMeals(userId);
      const ids = Array.from(new Set(favoriteRows.map((r) => r.foodId)));
      const foods = ids.length > 0 ? await foodsRepo.getByIds(ids) : [];
      setRows(favoriteRows);
      setFoodsById(new Map(foods.map((f) => [f.id, f])));
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  const sections = useMemo<FavoriteSection[]>(() => {
    const normalizedQuery = query.trim() ? normalizeForSearch(query) : "";

    // Build foodId -> all meal types it's favorited under (for cross-meal annotation)
    const mealsByFoodId = new Map<string, (MealType | null)[]>();
    for (const row of rows) {
      const existing = mealsByFoodId.get(row.foodId) ?? [];
      existing.push(row.mealType);
      mealsByFoodId.set(row.foodId, existing);
    }

    function matchesQuery(food: Food): boolean {
      if (!normalizedQuery) return true;
      const nameNormalized = food.nameNormalized || normalizeForSearch(food.name);
      return nameNormalized.includes(normalizedQuery);
    }

    const sectionOrder: (MealType | null)[] = [...MEAL_ORDER, null];

    return sectionOrder
      .map((mealType) => {
        const foodIdsInSection = rows.filter((r) => r.mealType === mealType).map((r) => r.foodId);

        const items: FavoriteListItem[] = foodIdsInSection
          .map((foodId) => foodsById.get(foodId))
          .filter((food): food is Food => food !== undefined)
          .filter(matchesQuery)
          .map((food) => {
            const allMeals = mealsByFoodId.get(food.id) ?? [];
            const otherMeals = allMeals.filter((m): m is MealType => m !== null && m !== mealType);
            return { ...food, otherMeals };
          });

        return { mealType, items };
      })
      .filter((section) => section.items.length > 0);
  }, [rows, foodsById, query]);

  async function remove(foodId: string): Promise<void> {
    // Optimistic: drop all rows for this foodId from local state immediately.
    setRows((prev) => prev.filter((r) => r.foodId !== foodId));
    await favoritesRepo.removeAllMeals(foodId, userId);
  }

  return {
    sections,
    loading,
    query,
    setQuery,
    remove,
    refresh: load,
  };
}
