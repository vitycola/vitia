/**
 * Minimal favorite-toggle hook for a single food.
 * Scope: toggle only — favorites-tab browsing UI stays out (see proposal).
 */

import * as favoritesRepo from "@/db/repos/favorites";
import { useAuthStore } from "@/src/stores/useAuthStore";
import { useEffect, useState } from "react";

export interface UseFavoriteResult {
  isFavorite: boolean;
  loading: boolean;
  toggle: () => Promise<void>;
}

export function useFavorite(foodId: string | null): UseFavoriteResult {
  const userId = useAuthStore((s) => s.userId);
  const [isFavorite, setIsFavorite] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!foodId) {
      setIsFavorite(false);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    favoritesRepo
      .isFavorite(foodId, userId)
      .then((fav) => {
        if (!cancelled) setIsFavorite(fav);
      })
      .catch(() => {
        if (!cancelled) setIsFavorite(false);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [foodId, userId]);

  async function toggle(): Promise<void> {
    if (!foodId) return;
    const newState = await favoritesRepo.toggle(foodId, userId);
    setIsFavorite(newState);
  }

  return { isFavorite, loading, toggle };
}
