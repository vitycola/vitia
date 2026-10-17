const mockGetAll = jest.fn();
const mockRemove = jest.fn();
jest.mock("@/db/repos/mealEntries", () => ({
  getAll: (...a: unknown[]) => mockGetAll(...a),
  remove: (...a: unknown[]) => mockRemove(...a),
}));

const mockGetByIds = jest.fn();
const mockDeleteFood = jest.fn();
jest.mock("@/db/repos/foods", () => ({
  getByIds: (...a: unknown[]) => mockGetByIds(...a),
  deleteFood: (...a: unknown[]) => mockDeleteFood(...a),
}));

let authState: { userId: string | null } = { userId: "user-1" };
jest.mock("@/src/stores/useAuthStore", () => ({
  useAuthStore: { getState: () => authState },
}));

import { cleanupDemoData, resetDemoCleanupForTests } from "@/src/services/demoCleanup";

let store: Record<string, string>;
let infoSpy: jest.SpyInstance;
let warnSpy: jest.SpyInstance;

beforeEach(() => {
  jest.clearAllMocks();
  resetDemoCleanupForTests();
  authState = { userId: "user-1" };
  store = {};
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => store[k] ?? null,
  };
  mockGetAll.mockResolvedValue([
    { id: "d1", foodId: "demo-food-oatmeal" },
    { id: "r1", foodId: "off-123" },
    { id: "d2", foodId: "demo-food-salmon" },
  ]);
  mockGetByIds.mockResolvedValue([{ id: "demo-food-oatmeal" }, { id: "demo-food-salmon" }]);
  infoSpy = jest.spyOn(console, "info").mockImplementation(() => {});
  warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  infoSpy.mockRestore();
  warnSpy.mockRestore();
});

describe("cleanupDemoData", () => {
  it("removes only demo meals (via repo remove) and demo foods", async () => {
    await expect(cleanupDemoData("user-1")).resolves.toBe(2);

    expect(mockRemove.mock.calls.map((c) => c[0])).toEqual(["d1", "d2"]);
    expect(mockGetByIds).toHaveBeenCalledWith(
      expect.arrayContaining(["demo-food-oatmeal", "demo-food-salmon"])
    );
    expect(mockDeleteFood.mock.calls.map((c) => c[0])).toEqual([
      "demo-food-oatmeal",
      "demo-food-salmon",
    ]);
    expect(infoSpy).toHaveBeenCalledTimes(1);
  });

  it("leaves real entries untouched when there is nothing to clean", async () => {
    mockGetAll.mockResolvedValue([{ id: "r1", foodId: "off-123" }]);
    mockGetByIds.mockResolvedValue([]);

    await expect(cleanupDemoData("user-1")).resolves.toBe(0);

    expect(mockRemove).not.toHaveBeenCalled();
    expect(mockDeleteFood).not.toHaveBeenCalled();
    expect(infoSpy).not.toHaveBeenCalled();
  });

  it("runs once per boot", async () => {
    await cleanupDemoData("user-1");
    await cleanupDemoData("user-1");

    expect(mockGetAll).toHaveBeenCalledTimes(1);
  });

  it("does nothing on a demo device", async () => {
    store["vitia.demoSeed"] = "v1";

    await expect(cleanupDemoData("user-1")).resolves.toBe(0);

    expect(mockGetAll).not.toHaveBeenCalled();
    expect(mockRemove).not.toHaveBeenCalled();
  });

  it("retries on the next call after a swallowed failure", async () => {
    mockGetAll.mockRejectedValueOnce(new Error("db down"));

    await expect(cleanupDemoData("user-1")).resolves.toBe(0);
    await expect(cleanupDemoData("user-1")).resolves.toBe(2);
  });

  it("skips (without marking done) when the auth store user does not match the session", async () => {
    authState = { userId: null };
    await expect(cleanupDemoData("user-1")).resolves.toBe(0);
    expect(mockGetAll).not.toHaveBeenCalled();

    authState = { userId: "user-1" };
    await expect(cleanupDemoData("user-1")).resolves.toBe(2);
  });

  it("never throws", async () => {
    mockGetAll.mockRejectedValue(new Error("db down"));

    await expect(cleanupDemoData("user-1")).resolves.toBe(0);
    expect(warnSpy).toHaveBeenCalled();
  });
});
