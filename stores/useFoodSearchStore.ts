import * as foodsRepo from "@/db/repos/foods";
import type { Food } from "@/db/schema";
import { search as genericSearch } from "@/lib/genericFoods";
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

// Module-level ref to the AbortController for the currently in-flight OFF
// request. Aborted at the start of every search() call so a stale request
// never races a newer one (design D7, spec: Query-Scoped Request
// Cancellation). Lives outside the store state because it is a mutable
// handle, not serializable/observable state.
let activeController: AbortController | null = null;

export const useFoodSearchStore = create<FoodSearchState & FoodSearchActions>()((set, get) => ({
  ...INITIAL_STATE,

  search: async (query: string) => {
    // Cancel any in-flight request for a previous query before starting a
    // new one — this is the query-scoped cancellation boundary.
    activeController?.abort();

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

    // 2. OFF + generic concurrent network calls.
    // Each source streams results into the store as soon as it resolves —
    // no waiting for the slower one. allSettled is used only to finalize
    // error/empty status after both have settled.
    const controller = new AbortController();
    activeController = controller;

    set({ status: "loading" });

    const isAbortError = (e: unknown) =>
      e instanceof DOMException && e.name === "AbortError";

    // Stream generic results as soon as Supabase responds (usually fast).
    const genericPromise = genericSearch(query, controller.signal).then((items) => {
      if (controller.signal.aborted) return;
      set((state) => {
        const seen = new Set(state.results.map((r) => r.id));
        const next = items
          .filter((r) => !seen.has(r.id))
          .map((r) => ({ ...r, hasMissingData: false }) as SearchResult);
        if (next.length === 0) return state;
        return { results: [...state.results, ...next], status: "results" as const };
      });
    });

    // Stream OFF results as soon as the network responds.
    const offPromise = offSearch(query, controller.signal).then((items) => {
      if (controller.signal.aborted) return;
      set((state) => {
        const seen = new Set(state.results.map((r) => r.id));
        const next = items
          .filter((r) => !seen.has(r.id))
          .map((r) => r as SearchResult);
        if (next.length === 0) return state;
        return { results: [...state.results, ...next], status: "results" as const };
      });
    });

    const [genericSettled, offSettled] = await Promise.allSettled([genericPromise, offPromise]);

    if (controller.signal.aborted) return;

    // Abort errors from either source — stop processing silently.
    if (
      (genericSettled.status === "rejected" && isAbortError(genericSettled.reason)) ||
      (offSettled.status === "rejected" && isAbortError(offSettled.reason))
    ) return;

    const genericFailed =
      genericSettled.status === "rejected" && !isAbortError(genericSettled.reason);
    const offFailed =
      offSettled.status === "rejected" && !isAbortError(offSettled.reason);

    if (genericFailed) {
      console.warn("[genericFoods] search failed (non-fatal):", genericSettled.reason);
    }

    // Error only when BOTH remotes fail AND no results at all (cache + streaming).
    const finalResults = get().results;
    if (offFailed && genericFailed && finalResults.length === 0) {
      const err = offSettled.status === "rejected" ? offSettled.reason : null;
      set({
        status: "error",
        error: err instanceof Error ? err.message : "Search failed: all remote sources failed",
      });
      return;
    }

    if (finalResults.length === 0) {
      set({ status: "empty" });
    }
  },

  clear: () => {
    activeController?.abort();
    set(INITIAL_STATE);
  },
}));
