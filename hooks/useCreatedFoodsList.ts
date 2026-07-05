/**
 * Data + view-model hook for the "Creados" (Created Foods) tab.
 * Loads all custom/composite foods via getCustomFoods() (already sorted by
 * createdAt descending at the repo layer) and supports a client-side name
 * filter, mirroring useFavoritesList's shape.
 */

import * as foodsRepo from "@/db/repos/foods";
import type { Food } from "@/db/schema";
import { normalizeForSearch } from "@/lib/search";
import { useCallback, useEffect, useMemo, useState } from "react";

export interface UseCreatedFoodsListResult {
  items: Food[];
  loading: boolean;
  /** Ids of created foods that are composite (have a persisted recipe) — drives the edit-recipe affordance. */
  compositeIds: Set<string>;
  refresh: () => Promise<void>;
}

export function useCreatedFoodsList(query: string): UseCreatedFoodsListResult {
  const [foods, setFoods] = useState<Food[]>([]);
  const [compositeIds, setCompositeIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [result, compositeFoodIds] = await Promise.all([
        foodsRepo.getCustomFoods(),
        foodsRepo.getCompositeFoodIds(),
      ]);
      setFoods(result);
      setCompositeIds(new Set(compositeFoodIds));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const items = useMemo(() => {
    const normalizedQuery = query.trim() ? normalizeForSearch(query) : "";
    if (!normalizedQuery) return foods;

    return foods.filter((food) => {
      const nameNormalized = food.nameNormalized || normalizeForSearch(food.name);
      return nameNormalized.includes(normalizedQuery);
    });
  }, [foods, query]);

  return {
    items,
    loading,
    compositeIds,
    refresh: load,
  };
}
