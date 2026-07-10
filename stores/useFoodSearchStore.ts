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

    // 2. OFF + generic concurrent network calls — status transitions reflect async phase.
    const controller = new AbortController();
    activeController = controller;

    set({ status: "loading" });

    const [offSettled, genericSettled] = await Promise.allSettled([
      offSearch(query, controller.signal),
      genericSearch(query, controller.signal),
    ]);

    // If this request was superseded/aborted after resolving (race
    // between abort() and the promise settling), do not apply its result.
    if (controller.signal.aborted) return;

    // Check if both remotes failed (excluding AbortErrors).
    const offFailed =
      offSettled.status === "rejected" &&
      !(offSettled.reason instanceof DOMException && offSettled.reason.name === "AbortError");
    const genericFailed =
      genericSettled.status === "rejected" &&
      !(
        genericSettled.reason instanceof DOMException && genericSettled.reason.name === "AbortError"
      );

    // Non-fatal AbortError from either remote — stop processing silently.
    const offAborted =
      offSettled.status === "rejected" &&
      offSettled.reason instanceof DOMException &&
      offSettled.reason.name === "AbortError";
    const genericAborted =
      genericSettled.status === "rejected" &&
      genericSettled.reason instanceof DOMException &&
      genericSettled.reason.name === "AbortError";
    if (offAborted || genericAborted) return;

    // Merge: combine local + OFF + generic results, deduplicate by food id.
    // Local results win on id conflict (existingIds check filters duplicates).
    const currentResults = get().results;
    const existingIds = new Set(currentResults.map((r) => r.id));

    const genericItems =
      genericSettled.status === "fulfilled"
        ? genericSettled.value
            .filter((r) => !existingIds.has(r.id))
            .map((r) => ({ ...r, hasMissingData: false }) as SearchResult)
        : [];
    for (const r of genericItems) existingIds.add(r.id);

    const offItems =
      offSettled.status === "fulfilled"
        ? offSettled.value.filter((r) => !existingIds.has(r.id)).map((r) => r as SearchResult)
        : [];

    const merged = [...currentResults, ...genericItems, ...offItems];

    // Error only when BOTH remotes fail AND local cache is empty.
    if (offFailed && genericFailed && merged.length === 0) {
      const offErr = offSettled.status === "rejected" ? offSettled.reason : null;
      set({
        status: "error",
        error:
          offErr instanceof Error ? offErr.message : "Search failed: all remote sources failed",
      });
      return;
    }

    set({
      results: merged,
      status: merged.length > 0 ? "results" : "empty",
    });
  },

  clear: () => {
    activeController?.abort();
    set(INITIAL_STATE);
  },
}));
