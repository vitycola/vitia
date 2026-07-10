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
  upsertMany: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("@/lib/openFoodFacts", () => ({
  search: jest.fn(),
}));
jest.mock("@/lib/genericFoods", () => ({
  search: jest.fn(),
}));

import * as foodsRepo from "@/db/repos/foods";
import * as offFacts from "@/lib/openFoodFacts";
import * as genericFoods from "@/lib/genericFoods";
// Imported after mocks so the store module picks up the mocked deps.
import { useFoodSearchStore } from "@/stores/useFoodSearchStore";

const mockedSearchByName = foodsRepo.searchByName as jest.MockedFunction<
  typeof foodsRepo.searchByName
>;
const mockedOffSearch = offFacts.search as jest.MockedFunction<typeof offFacts.search>;
const mockedGenericSearch = genericFoods.search as jest.MockedFunction<typeof genericFoods.search>;

function resetStore() {
  useFoodSearchStore.getState().clear();
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

const localFood = {
  id: "local-1",
  name: "Cached Food",
  brand: null,
  caloriesPer100g: 50,
  proteinPer100g: 1,
  carbsPer100g: 5,
  fatPer100g: 1,
  servingSizeG: null,
  source: "custom" as const,
  category: null,
  dataBasis: null,
  offProductCode: null,
  imageUrl: null,
  nameNormalized: "cached food",
  createdAt: "2024-01-01T00:00:00.000Z",
};

const offFood = {
  id: "off-1",
  name: "OFF Food",
  brand: null,
  caloriesPer100g: 100,
  proteinPer100g: 5,
  carbsPer100g: 10,
  fatPer100g: 2,
  servingSizeG: null,
  source: "openfoodfacts" as const,
  offProductCode: "off-1",
  imageUrl: null,
  hasMissingData: false,
};

const genericFood1 = {
  id: "generic-1",
  name: "Generic Food 1",
  brand: null,
  caloriesPer100g: 200,
  proteinPer100g: 20,
  carbsPer100g: 5,
  fatPer100g: 8,
  servingSizeG: null,
  source: "generic" as const,
  offProductCode: null,
  imageUrl: null,
  nameNormalized: "generic food 1",
  category: "carnes",
  dataBasis: "crudo" as const,
  createdAt: "2026-01-01T00:00:00.000Z",
};

const genericFood2 = { ...genericFood1, id: "generic-2", name: "Generic Food 2" };
const genericFood3 = { ...genericFood1, id: "generic-3", name: "Generic Food 3" };

describe("useFoodSearchStore", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedSearchByName.mockResolvedValue([]);
    mockedGenericSearch.mockResolvedValue([]);
    resetStore();
  });

  it("sets status 'empty' when OFF and generic both respond with zero results (spec: Zero results)", async () => {
    mockedOffSearch.mockResolvedValue([]);
    mockedGenericSearch.mockResolvedValue([]);

    await useFoodSearchStore.getState().search("nonexistent food xyz");

    expect(useFoodSearchStore.getState().status).toBe("empty");
    expect(useFoodSearchStore.getState().error).toBeNull();
  });

  it("sets status 'error' (not empty) when BOTH remotes fail and cache is empty", async () => {
    mockedOffSearch.mockRejectedValue(new Error("OFF search proxy failed with status 502"));
    mockedGenericSearch.mockRejectedValue(new Error("Generic search failed"));

    await useFoodSearchStore.getState().search("banana");

    expect(useFoodSearchStore.getState().status).toBe("error");
    // Error message comes from OFF (first settled rejection).
    expect(useFoodSearchStore.getState().error).toBe("OFF search proxy failed with status 502");
  });

  it("does NOT set error when only OFF fails but generic succeeds", async () => {
    mockedOffSearch.mockRejectedValue(new Error("OFF down"));
    mockedGenericSearch.mockResolvedValue([genericFood1]);

    await useFoodSearchStore.getState().search("food");

    expect(useFoodSearchStore.getState().status).toBe("results");
    expect(useFoodSearchStore.getState().error).toBeNull();
  });

  it("does NOT set error when only generic fails but OFF succeeds", async () => {
    mockedOffSearch.mockResolvedValue([offFood]);
    mockedGenericSearch.mockRejectedValue(new Error("Generic down"));

    await useFoodSearchStore.getState().search("food");

    expect(useFoodSearchStore.getState().status).toBe("results");
    expect(useFoodSearchStore.getState().error).toBeNull();
  });

  it("sets status 'results' with items when OFF returns products", async () => {
    mockedOffSearch.mockResolvedValue([offFood]);

    await useFoodSearchStore.getState().search("banana");

    const state = useFoodSearchStore.getState();
    expect(state.status).toBe("results");
    expect(state.results.map((r) => r.id)).toContain("off-1");
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
    mockedSearchByName.mockResolvedValue([localFood]);
    mockedOffSearch.mockResolvedValue([]);

    await useFoodSearchStore.getState().search("cached");

    const state = useFoodSearchStore.getState();
    expect(state.results.map((r) => r.id)).toContain("local-1");
  });

  // ── Generic integration ──────────────────────────────────────────────────

  it("(5.4a) generic results merged with local + OFF (2 local + 3 generic = 5 total)", async () => {
    const localFood2 = { ...localFood, id: "local-2", name: "Cached Food 2" };
    mockedSearchByName.mockResolvedValue([localFood, localFood2]);
    mockedOffSearch.mockResolvedValue([]);
    mockedGenericSearch.mockResolvedValue([genericFood1, genericFood2, genericFood3]);

    await useFoodSearchStore.getState().search("food");

    const state = useFoodSearchStore.getState();
    expect(state.results).toHaveLength(5);
    expect(state.results.map((r) => r.id)).toEqual(
      expect.arrayContaining(["local-1", "local-2", "generic-1", "generic-2", "generic-3"])
    );
  });

  it("(5.4b) generic results have source='generic' after merge", async () => {
    mockedSearchByName.mockResolvedValue([]);
    mockedOffSearch.mockResolvedValue([]);
    mockedGenericSearch.mockResolvedValue([genericFood1]);

    await useFoodSearchStore.getState().search("pollo");

    const state = useFoodSearchStore.getState();
    const genericResult = state.results.find((r) => r.id === "generic-1");
    expect(genericResult?.source).toBe("generic");
  });

  it("(5.4c) generic failure does not block cache + OFF results", async () => {
    mockedSearchByName.mockResolvedValue([localFood]);
    mockedOffSearch.mockResolvedValue([offFood]);
    mockedGenericSearch.mockRejectedValue(new Error("Generic network error"));

    await useFoodSearchStore.getState().search("food");

    const state = useFoodSearchStore.getState();
    expect(state.status).toBe("results");
    expect(state.results.map((r) => r.id)).toContain("local-1");
    expect(state.results.map((r) => r.id)).toContain("off-1");
  });

  it("(5.4d) duplicate id deduplication — local version wins", async () => {
    // Generic returns a food with the same id as a local food.
    const genericDuplicate = { ...genericFood1, id: "local-1", name: "Generic Overwrite Attempt" };
    mockedSearchByName.mockResolvedValue([localFood]);
    mockedOffSearch.mockResolvedValue([]);
    mockedGenericSearch.mockResolvedValue([genericDuplicate]);

    await useFoodSearchStore.getState().search("food");

    const state = useFoodSearchStore.getState();
    // Only one item with id "local-1" in results.
    const matches = state.results.filter((r) => r.id === "local-1");
    expect(matches).toHaveLength(1);
    // The local version wins — name from local cache, not generic.
    expect(matches[0].name).toBe("Cached Food");
  });
});
