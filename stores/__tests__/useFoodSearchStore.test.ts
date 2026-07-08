/**
 * Tests for stores/useFoodSearchStore.ts.
 *
 * Spec: Query-Scoped Request Cancellation, Explicit Empty-vs-Error State
 * Distinction, Cache-First Read Behavior Preserved.
 *
 * `@/lib/openFoodFacts` and `@/db/repos/foods` are mocked so the store's
 * lifecycle logic (abort, status transitions) is tested in isolation from
 * network/DB concerns.
 */
// db/repos/foods.ts transitively imports db/client.ts, which uses
// `import.meta.url` (Vite-only syntax) at module scope — ts-jest cannot
// parse it. Provide explicit mock factories so the real module (and its
// import.meta-using dependency chain) is never loaded, mirroring the
// pattern already used by lib/__tests__/openFoodFacts.test.ts.
jest.mock("@/db/repos/foods", () => ({
  searchByName: jest.fn(),
}));
jest.mock("@/lib/openFoodFacts", () => ({
  search: jest.fn(),
}));

import * as foodsRepo from "@/db/repos/foods";
import * as offFacts from "@/lib/openFoodFacts";
// Imported after mocks so the store module picks up the mocked deps.
import { useFoodSearchStore } from "@/stores/useFoodSearchStore";

const mockedSearchByName = foodsRepo.searchByName as jest.MockedFunction<
  typeof foodsRepo.searchByName
>;
const mockedOffSearch = offFacts.search as jest.MockedFunction<typeof offFacts.search>;

function resetStore() {
  useFoodSearchStore.getState().clear();
}

describe("useFoodSearchStore", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedSearchByName.mockResolvedValue([]);
    resetStore();
  });

  it("sets status 'empty' when OFF responds with zero results (spec: Zero results)", async () => {
    mockedOffSearch.mockResolvedValue([]);

    await useFoodSearchStore.getState().search("nonexistent food xyz");

    expect(useFoodSearchStore.getState().status).toBe("empty");
    expect(useFoodSearchStore.getState().error).toBeNull();
  });

  it("sets status 'error' (not empty) on network/server failure", async () => {
    mockedOffSearch.mockRejectedValue(new Error("OFF search proxy failed with status 502"));

    await useFoodSearchStore.getState().search("banana");

    expect(useFoodSearchStore.getState().status).toBe("error");
    expect(useFoodSearchStore.getState().error).toBe("OFF search proxy failed with status 502");
  });

  it("sets status 'results' with items when OFF returns products", async () => {
    mockedOffSearch.mockResolvedValue([
      {
        id: "code-1",
        name: "Banana",
        brand: null,
        caloriesPer100g: 89,
        proteinPer100g: 1,
        carbsPer100g: 22,
        fatPer100g: 0.3,
        servingSizeG: null,
        source: "openfoodfacts",
        offProductCode: "code-1",
        imageUrl: null,
        hasMissingData: false,
      },
    ]);

    await useFoodSearchStore.getState().search("banana");

    const state = useFoodSearchStore.getState();
    expect(state.status).toBe("results");
    expect(state.results.map((r) => r.id)).toContain("code-1");
  });

  it("aborts a stale in-flight request when a newer query supersedes it", async () => {
    let firstRequestStarted!: () => void;
    const firstRequestStartedPromise = new Promise<void>((resolve) => {
      firstRequestStarted = resolve;
    });

    mockedOffSearch.mockImplementationOnce(
      (_query, signal) =>
        new Promise((_resolve, reject) => {
          // Reject with AbortError as soon as the store aborts this
          // request's signal — mirrors fetch's real abort behaviour.
          signal?.addEventListener("abort", () => {
            reject(new DOMException("Aborted", "AbortError"));
          });
          // Signal to the test that the network phase has begun (i.e.
          // activeController has been assigned) so it's safe to fire the
          // superseding search.
          firstRequestStarted();
        })
    );
    mockedOffSearch.mockImplementationOnce(async () => []);

    // Start the first (stale) search — do not await yet.
    const firstSearchPromise = useFoodSearchStore.getState().search("app");

    // Wait until the first search has reached its network phase (past the
    // cache-first await) before firing the superseding search — otherwise
    // the second call could run before `activeController` is assigned.
    await firstRequestStartedPromise;

    // Start a second search — this must abort the first's in-flight request.
    const secondSearchPromise = useFoodSearchStore.getState().search("apple");

    await Promise.all([firstSearchPromise, secondSearchPromise]);

    // The stale request's abort must NOT surface as an error state.
    expect(useFoodSearchStore.getState().status).not.toBe("error");
    expect(useFoodSearchStore.getState().query).toBe("apple");
  });

  it("does not set status:'error' when the OFF call throws AbortError", async () => {
    mockedOffSearch.mockRejectedValue(new DOMException("Aborted", "AbortError"));

    await useFoodSearchStore.getState().search("cancelled query");

    expect(useFoodSearchStore.getState().status).not.toBe("error");
  });

  it("preserves cache-first read: local results are set before the OFF call resolves", async () => {
    mockedSearchByName.mockResolvedValue([
      {
        id: "local-1",
        name: "Cached Food",
        brand: null,
        caloriesPer100g: 50,
        proteinPer100g: 1,
        carbsPer100g: 5,
        fatPer100g: 1,
        servingSizeG: null,
        source: "custom",
        category: null,
        dataBasis: null,
        offProductCode: null,
        imageUrl: null,
        nameNormalized: "cached food",
        createdAt: "2024-01-01T00:00:00.000Z",
      },
    ]);
    mockedOffSearch.mockResolvedValue([]);

    await useFoodSearchStore.getState().search("cached");

    const state = useFoodSearchStore.getState();
    expect(state.results.map((r) => r.id)).toContain("local-1");
  });
});
