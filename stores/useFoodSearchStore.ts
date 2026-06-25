import * as foodsRepo from "@/db/repositories/foods";
import type { Food } from "@/db/schema";
import { search as offSearch } from "@/lib/openFoodFacts";
import { create } from "zustand";

// ── Extended Food with missing-data flag ───────────────────────────────
export interface SearchResult extends Food {
  hasMissingData: boolean;
}

// ── Store shape ────────────────────────────────────────────────────────
interface FoodSearchState {
  query: string;
  results: SearchResult[];
  isLoading: boolean;
  error: string | null; // internal only; never surfaced as an offline banner
}

interface FoodSearchActions {
  /**
   * Run a cache-first search:
   * 1. Query local SQLite immediately for instant offline results.
   * 2. Concurrently fetch Open Food Facts (Spain); upsert + merge on response.
   * `isLoading` is true only during the OFF network call.
   */
  search: (query: string) => Promise<void>;
  /** Reset all state to initial values. */
  clear: () => void;
}

const INITIAL_STATE: FoodSearchState = {
  query: "",
  results: [],
  isLoading: false,
  error: null,
};

export const useFoodSearchStore = create<FoodSearchState & FoodSearchActions>()((set, get) => ({
  ...INITIAL_STATE,

  search: async (query: string) => {
    set({ query, error: null });

    if (!query.trim() || query.length < 2) {
      set({ results: [], isLoading: false });
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

    // 2. OFF network call — isLoading true only for the async phase.
    set({ isLoading: true });
    try {
      const offResults = await offSearch(query);

      // Merge: combine local + OFF results, deduplicate by food id.
      const currentResults = get().results;
      const existingIds = new Set(currentResults.map((r) => r.id));

      const newItems = offResults
        .filter((r) => !existingIds.has(r.id))
        .map((r) => {
          // offResults include hasMissingData from normalizeOffProduct.
          // We need a full Food shape — pull from the local cache post-upsert.
          return r as SearchResult;
        });

      set({ results: [...currentResults, ...newItems], isLoading: false });
    } catch (err) {
      // OFF failure is silent — FR-063: no offline error banner.
      set({
        isLoading: false,
        error: err instanceof Error ? err.message : "OFF search failed",
      });
    }
  },

  clear: () => {
    set(INITIAL_STATE);
  },
}));
