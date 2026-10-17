import {
  DEMO_FOOD_IDS,
  hasEverHeldAuthSession,
  isDemoDevice,
  isDemoMealEntry,
} from "@/src/services/demoGuard";

let store: Record<string, string>;

function installStorage(): void {
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => store[k] ?? null,
    key: (i: number) => Object.keys(store)[i] ?? null,
    get length() {
      return Object.keys(store).length;
    },
  };
}

beforeEach(() => {
  store = {};
  installStorage();
});

describe("isDemoMealEntry", () => {
  it("matches camelCase and snake_case demo food ids", () => {
    expect(isDemoMealEntry({ foodId: "demo-food-salad" })).toBe(true);
    expect(isDemoMealEntry({ food_id: "demo-food-salmon" })).toBe(true);
  });

  it("ignores real entries and malformed input", () => {
    expect(isDemoMealEntry({ foodId: "off-123" })).toBe(false);
    expect(isDemoMealEntry({})).toBe(false);
    expect(isDemoMealEntry(null)).toBe(false);
    expect(isDemoMealEntry("demo-food-x")).toBe(false);
  });

  it("DEMO_FOOD_IDS all carry the demo prefix", () => {
    expect(DEMO_FOOD_IDS.every((id) => isDemoMealEntry({ foodId: id }))).toBe(true);
  });
});

describe("isDemoDevice", () => {
  it("is true only with the seed marker", () => {
    expect(isDemoDevice()).toBe(false);
    store["vitia.demoSeed"] = "v1";
    expect(isDemoDevice()).toBe(true);
  });

  it("returns false when storage throws", () => {
    (globalThis as { localStorage?: unknown }).localStorage = {
      getItem: () => {
        throw new Error("denied");
      },
    };
    expect(isDemoDevice()).toBe(false);
  });
});

describe("hasEverHeldAuthSession", () => {
  it("detects sb-*-auth-token keys", () => {
    store.other = "1";
    expect(hasEverHeldAuthSession()).toBe(false);
    store["sb-abcdef-auth-token"] = "{}";
    expect(hasEverHeldAuthSession()).toBe(true);
  });

  it("returns false when storage throws", () => {
    (globalThis as { localStorage?: unknown }).localStorage = {
      get length(): number {
        throw new Error("denied");
      },
    };
    expect(hasEverHeldAuthSession()).toBe(false);
  });
});
