import * as foodsRepo from "@/db/repos/foods";
import type { Food } from "@/db/schema";
import { search as offSearch } from "@/lib/openFoodFacts";
import { create } from "zustand";

// ── Extended Food with missing-data flag ───────────────────────────────
export interface SearchResult extends Food {
  hasMissingData: boolean;
}

// ── Status state machine ───────────────────────────────────────────────
export type SearchStatus = "idle" | "loading" | "results" | "empty" | "error";

// ── Store shape ────────────────────────────────────────────────────────
interface FoodSearchState {
  query: string;
  results: SearchResult[];
  status: SearchStatus;
  error: string | null;
}

interface FoodSearchActions {
  /**
   * Run a cache-first search:
   * 1. Query local SQLite immediately for instant offline results.
   * 2. Concurrently fetch Open Food Facts (Spain); upsert + merge on response.
   * `status` reflects the OFF network call lifecycle.
   */
  search: (query: string) => Promise<void>;
  /** Reset all state to initial values. */
  clear: () => void;
}

const INITIAL_STATE: FoodSearchState = {
  query: "",
  results: [],
  status: "idle",
  error: null,
};

export const useFoodSearchStore = create<FoodSearchState & FoodSearchActions>()((set, get) => ({
  ...INITIAL_STATE,

  search: async (query: string) => {
    set({ query, error: null });

    if (!query.trim() || query.length < 2) {
      set({ results: [], status: "idle" });
      return;
    }

    // 1. Local cache — instant results while OFF is in flight.
    try {
      const localResults = await foodsRepo.searchByName(query);
      set({
        results: localResults.map((f) => ({ ...f, hasMissingData: false })),
      });
    } catch {
      // Cache miss is non-fatal — OFF may still return results.
    }

    // 2. OFF network call — status transitions reflect async phase.
    set({ status: "loading" });
    try {
      const offResults = await offSearch(query);

      // Merge: combine local + OFF results, deduplicate by food id.
      const currentResults = get().results;
      const existingIds = new Set(currentResults.map((r) => r.id));

      const newItems = offResults
        .filter((r) => !existingIds.has(r.id))
        .map((r) => r as SearchResult);

      const merged = [...currentResults, ...newItems];
      set({
        results: merged,
        status: merged.length > 0 ? "results" : "empty",
      });
    } catch (err) {
      // OFF threw — surface error state; keep any cached results visible.
      set({
        status: "error",
        error: err instanceof Error ? err.message : "OFF search failed",
      });
    }
  },

  clear: () => {
    set(INITIAL_STATE);
  },
}));
