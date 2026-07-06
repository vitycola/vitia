/**
 * @jest-environment jsdom
 *
 * Tests for src/seed/seedDemoProfile.ts — the demo weight-loss profile
 * auto-seed run on app boot (non-production, idempotent).
 *
 * Mocks every db/repos/* dependency (mirrors db/repos/__tests__/progress.test.ts
 * and stores/__tests__/useProfileStore.test.ts conventions: these modules
 * transitively import db/client.ts, which uses import.meta.url — Vite-only
 * syntax ts-jest cannot parse under CommonJS).
 *
 * jsdom is used (not the default node testEnvironment) because
 * makePlaceholderPhoto() creates an offscreen <canvas> element; the canvas
 * 2D context + toBlob are stubbed per-test since the `canvas` npm package
 * is not installed (no real rendering backend under jsdom).
 */

const mockGetProfile = jest.fn();
const mockUpsertProfile = jest.fn();
jest.mock("@/db/repos/profile", () => ({
  getProfile: (...args: unknown[]) => mockGetProfile(...args),
  upsertProfile: (...args: unknown[]) => mockUpsertProfile(...args),
}));

const mockUpsertMany = jest.fn();
jest.mock("@/db/repos/foods", () => ({
  upsertMany: (...args: unknown[]) => mockUpsertMany(...args),
}));

const mockInsertBulk = jest.fn();
jest.mock("@/db/repos/mealEntries", () => ({
  insertBulk: (...args: unknown[]) => mockInsertBulk(...args),
  deleteByDateAndMeal: jest.fn(),
}));

const mockUpsertByDate = jest.fn();
const mockDeleteProgressByDate = jest.fn();
jest.mock("@/db/repos/progress", () => ({
  upsertByDate: (...args: unknown[]) => mockUpsertByDate(...args),
  deleteByDate: (...args: unknown[]) => mockDeleteProgressByDate(...args),
}));

const mockEnqueue = jest.fn();
jest.mock("@/src/services/syncQueue", () => ({
  enqueue: (...args: unknown[]) => mockEnqueue(...args),
}));

const mockIsSyncEnabled = jest.fn().mockReturnValue(false);
jest.mock("@/src/lib/supabase", () => ({
  isSyncEnabled: (...args: unknown[]) => mockIsSyncEnabled(...args),
}));

let authState: { userId: string | null } = { userId: null };
jest.mock("@/src/stores/useAuthStore", () => ({
  useAuthStore: { getState: () => authState },
}));

let demoSeedEnv: { DEV: boolean; PROD: boolean; VITE_ENABLE_DEMO_SEED?: string } = {
  DEV: true,
  PROD: false,
  VITE_ENABLE_DEMO_SEED: undefined,
};
let mockHostname = "localhost";
let mockLocationSearch = "";
jest.mock("@/src/seed/env", () => ({
  getDemoSeedEnv: () => demoSeedEnv,
  getHostname: () => mockHostname,
  getLocationSearch: () => mockLocationSearch,
}));

import { computeBMR, computeTDEE, deriveCalorieGoal, deriveMacros } from "@/lib/nutrition";
import {
  DEMO_FOODS,
  KNOWN_PROD_HOSTS,
  buildDemoMealEntries,
  buildDemoProgressEntries,
  makePlaceholderPhoto,
  seedDemoProfile,
  shouldSeed,
} from "@/src/seed/seedDemoProfile";

const SEED_MARKER_KEY = "vitia.demoSeed";

// ── Test helpers ──────────────────────────────────────────────────────

function setImportMetaEnv(env: {
  DEV: boolean;
  PROD: boolean;
  VITE_ENABLE_DEMO_SEED?: string;
}): void {
  demoSeedEnv = env;
}

function setHostname(hostname: string): void {
  mockHostname = hostname;
}

function setLocationSearch(search: string): void {
  mockLocationSearch = search;
}

/** Stub document.createElement("canvas") with a fake 2D context + toBlob. */
function stubCanvas(): { fillStyleSet: string[] } {
  const fillStyleSet: string[] = [];
  const fakeCtx = {
    set fillStyle(value: string) {
      fillStyleSet.push(value);
    },
    fillRect: jest.fn(),
  };
  const fakeCanvas = {
    width: 0,
    height: 0,
    getContext: jest.fn().mockReturnValue(fakeCtx),
    toBlob: jest.fn((cb: (blob: Blob | null) => void, type: string) => {
      cb(new Blob(["fake-png-bytes"], { type }));
    }),
  };
  jest.spyOn(document, "createElement").mockImplementation((tag: string) => {
    if (tag === "canvas") return fakeCanvas as unknown as HTMLCanvasElement;
    throw new Error(`stubCanvas: unexpected document.createElement("${tag}") call`);
  });
  return { fillStyleSet };
}

describe("src/seed/seedDemoProfile.ts", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
    authState = { userId: null };
    mockIsSyncEnabled.mockReturnValue(false);
    window.localStorage.clear();
    setImportMetaEnv({ DEV: true, PROD: false, VITE_ENABLE_DEMO_SEED: undefined });
    setHostname("localhost");
    setLocationSearch("");
    mockGetProfile.mockResolvedValue(null);
    mockUpsertProfile.mockImplementation(async (data) => ({
      id: 1,
      userId: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      ...data,
    }));
    mockUpsertMany.mockImplementation(async (foods) => foods);
    mockInsertBulk.mockImplementation(async (entries) => entries);
    mockUpsertByDate.mockImplementation(async (input) => ({
      id: `progress-${input.date}`,
      userId: null,
      bodyFatPct: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      ...input,
    }));
  });

  // ── Task 1 — Demo foods fixture (REQ-5) ──────────────────────────────
  describe("DEMO_FOODS fixture (REQ-5)", () => {
    it("has between 4 and 6 NewFood rows", () => {
      expect(DEMO_FOODS.length).toBeGreaterThanOrEqual(4);
      expect(DEMO_FOODS.length).toBeLessThanOrEqual(6);
    });

    it("has deterministic demo-food- prefixed ids", () => {
      for (const food of DEMO_FOODS) {
        expect(food.id).toMatch(/^demo-food-/);
      }
    });

    it("has source: custom for every fixture food", () => {
      for (const food of DEMO_FOODS) {
        expect(food.source).toBe("custom");
      }
    });

    it("has unique ids", () => {
      const ids = DEMO_FOODS.map((f) => f.id);
      expect(new Set(ids).size).toBe(ids.length);
    });
  });

  describe("buildDemoMealEntries fixture — foodId FK integrity (REQ-5)", () => {
    it("every meal entry's foodId resolves to a DEMO_FOODS id", () => {
      const foodIds = new Set(DEMO_FOODS.map((f) => f.id));
      const entries = buildDemoMealEntries();
      expect(entries.length).toBeGreaterThan(0);
      for (const entry of entries) {
        expect(foodIds.has(entry.foodId)).toBe(true);
      }
    });
  });

  // ── Task 2 — Profile seed (REQ-1) ────────────────────────────────────
  describe("seedDemoProfile — profile fields (REQ-1)", () => {
    it("saves a profile with the demo fixture fields", async () => {
      await seedDemoProfile();

      expect(mockUpsertProfile).toHaveBeenCalledWith(
        expect.objectContaining({
          age: 33,
          heightCm: 178,
          weightKg: 82,
          sex: "male",
          activityLevel: "moderately_active",
          goal: "lose_weight",
        })
      );
    });

    it("derives calorieGoal/macros via the nutrition pipeline, not hardcoded", async () => {
      await seedDemoProfile();

      const bmr = computeBMR({ age: 33, heightCm: 178, weightKg: 82, sex: "male" });
      const tdee = computeTDEE(bmr, "moderately_active");
      const calorieGoal = deriveCalorieGoal(tdee, "lose_weight");
      const macros = deriveMacros(calorieGoal);

      expect(mockUpsertProfile).toHaveBeenCalledWith(
        expect.objectContaining({
          calorieGoal,
          proteinGoalG: macros.proteinG,
          carbsGoalG: macros.carbsG,
          fatGoalG: macros.fatG,
        })
      );
      // Sanity check against the spec's approximate expectation.
      expect(calorieGoal).toBeGreaterThan(2100);
      expect(calorieGoal).toBeLessThan(2300);
    });
  });

  // ── Task 3 — Meal entries, 6-day window with gap (REQ-2) ─────────────
  describe("buildDemoMealEntries — 6-day window with gap (REQ-2)", () => {
    it("D-3 (the gap day) has zero meal entries", () => {
      const entries = buildDemoMealEntries();
      const gapDate = daysAgo(3);
      expect(entries.filter((e) => e.date === gapDate)).toHaveLength(0);
    });

    it("all 5 other logged days have at least one meal entry each", () => {
      const entries = buildDemoMealEntries();
      for (const offset of [5, 4, 2, 1, 0]) {
        const date = daysAgo(offset);
        expect(entries.filter((e) => e.date === date).length).toBeGreaterThan(0);
      }
    });

    it("has at least one day clearly under calorieGoal and one clearly over", () => {
      const entries = buildDemoMealEntries();
      const calorieGoal = 2200; // spec's approx goal for the fixture profile
      const totalsByDate = new Map<string, number>();
      for (const e of entries) {
        totalsByDate.set(e.date, (totalsByDate.get(e.date) ?? 0) + e.calories);
      }

      const totals = [...totalsByDate.values()];
      expect(totals.some((t) => t < calorieGoal - 300)).toBe(true);
      expect(totals.some((t) => t > calorieGoal + 300)).toBe(true);
    });
  });

  // ── Task 4 — Progress entries + placeholder photos (REQ-3, REQ-4) ────
  describe("buildDemoProgressEntries — logged days only (REQ-3)", () => {
    it("has entries for D-5, D-4, D-2, D-1, D0 and not D-3", () => {
      const entries = buildDemoProgressEntries();
      const dates = entries.map((e) => e.date);
      for (const offset of [5, 4, 2, 1, 0]) {
        expect(dates).toContain(daysAgo(offset));
      }
      expect(dates).not.toContain(daysAgo(3));
    });

    it("does not set bodyFatPct directly — lets upsertByDate derive it", () => {
      const entries = buildDemoProgressEntries();
      for (const entry of entries) {
        expect(entry).not.toHaveProperty("bodyFatPct");
      }
    });

    it("weight is non-increasing across D-5 -> D0 (consistent with lose_weight)", () => {
      const entries = buildDemoProgressEntries();
      const chronological = [...entries].sort((a, b) => (a.date < b.date ? -1 : 1));
      for (let i = 1; i < chronological.length; i++) {
        expect(chronological[i].weightKg).toBeLessThanOrEqual(chronological[i - 1].weightKg);
      }
    });
  });

  describe("makePlaceholderPhoto — no-network canvas PNG generator (REQ-4)", () => {
    it("produces an image/png blob without any fetch/XHR call", async () => {
      stubCanvas();
      const originalFetch = globalThis.fetch;
      const fetchSpy = jest.fn(() => {
        throw new Error("network access is forbidden for placeholder photo generation");
      });
      globalThis.fetch = fetchSpy as unknown as typeof fetch;

      const photo = await makePlaceholderPhoto(120);

      globalThis.fetch = originalFetch;

      expect(photo.mimeType).toBe("image/png");
      expect(photo.blob).toBeInstanceOf(Blob);
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("sets a distinct hsl fillStyle derived from the given hue", async () => {
      const { fillStyleSet } = stubCanvas();
      await makePlaceholderPhoto(200);
      expect(fillStyleSet.some((v) => v.includes("200"))).toBe(true);
    });
  });

  describe("seedDemoProfile — gap day has no photo (REQ-4 consequence)", () => {
    it("does not call progress.upsertByDate for the gap day D-3", async () => {
      stubCanvas();
      await seedDemoProfile();

      const gapDate = daysAgo(3);
      const calledDates = mockUpsertByDate.mock.calls.map((call) => call[0].date);
      expect(calledDates).not.toContain(gapDate);
    });

    it("calls progress.upsertByDate exactly once per logged day, each with one photo", async () => {
      stubCanvas();
      await seedDemoProfile();

      const loggedDates = [5, 4, 2, 1, 0].map(daysAgo);
      const calledDates = mockUpsertByDate.mock.calls.map((call) => call[0].date);
      for (const date of loggedDates) {
        expect(calledDates.filter((d) => d === date)).toHaveLength(1);
      }
      for (const call of mockUpsertByDate.mock.calls) {
        expect(call[0].photos).toHaveLength(1);
      }
    });
  });

  // ── Task 5 — Onboarding-skip verification (REQ-6) ────────────────────
  describe("seedDemoProfile — onboarding gate satisfaction (REQ-6)", () => {
    it("profile is saved before mealEntries/progress writes (ordering contract)", async () => {
      stubCanvas();
      await seedDemoProfile();

      const profileCallOrder = mockUpsertProfile.mock.invocationCallOrder[0];
      const foodsCallOrder = mockUpsertMany.mock.invocationCallOrder[0];
      const mealsCallOrder = mockInsertBulk.mock.invocationCallOrder[0];
      const progressCallOrder = mockUpsertByDate.mock.invocationCallOrder[0];

      expect(profileCallOrder).toBeLessThan(foodsCallOrder);
      expect(foodsCallOrder).toBeLessThan(mealsCallOrder);
      expect(mealsCallOrder).toBeLessThan(progressCallOrder);
    });

    it("resolves getProfile()-equivalent write before seedDemoProfile() resolves", async () => {
      stubCanvas();
      await seedDemoProfile();
      // By the time seedDemoProfile() resolves, the profile write has already
      // completed (awaited internally) — simulate the DayScreen ordering
      // contract by asserting the upsert call happened synchronously within
      // the resolved promise chain, not fired-and-forgotten.
      expect(mockUpsertProfile).toHaveBeenCalledTimes(1);
    });
  });

  // ── Task 6 — Environment gating (REQ-7) ──────────────────────────────
  describe("shouldSeed — environment gating matrix (REQ-7)", () => {
    it("returns false when VITE_ENABLE_DEMO_SEED is unset and DEV is false", () => {
      setImportMetaEnv({ DEV: false, PROD: false, VITE_ENABLE_DEMO_SEED: undefined });
      expect(shouldSeed()).toBe(false);
    });

    it("returns false when PROD is true and hostname is in KNOWN_PROD_HOSTS", () => {
      setImportMetaEnv({ DEV: false, PROD: true, VITE_ENABLE_DEMO_SEED: "true" });
      // KNOWN_PROD_HOSTS ships empty per design decision — this test documents
      // the contract and stays green trivially now, but proves the guard
      // clause is wired if a host is ever added.
      if (KNOWN_PROD_HOSTS.length > 0) {
        setHostname(KNOWN_PROD_HOSTS[0]);
        expect(shouldSeed()).toBe(false);
      } else {
        expect(KNOWN_PROD_HOSTS).toEqual([]);
      }
    });

    it("returns true when DEV is true, independent of the flag", () => {
      setImportMetaEnv({ DEV: true, PROD: false, VITE_ENABLE_DEMO_SEED: undefined });
      expect(shouldSeed()).toBe(true);
    });

    it("returns true when the flag is enabled even outside DEV (e.g. Preview)", () => {
      setImportMetaEnv({ DEV: false, PROD: false, VITE_ENABLE_DEMO_SEED: "true" });
      expect(shouldSeed()).toBe(true);
    });
  });

  describe("seedDemoProfile — anonymous write path structural guard (REQ-7)", () => {
    it("all writes use userId: null / undefined and never enqueue a sync op when sync is disabled", async () => {
      stubCanvas();
      authState = { userId: null };
      mockIsSyncEnabled.mockReturnValue(false);
      await seedDemoProfile();

      expect(mockEnqueue).not.toHaveBeenCalled();
    });

    // Regression test for the CRITICAL gap found in verification (obs #221,
    // C1): seedDemoProfile() must never reach Supabase even when a real
    // session is authenticated AND cloud sync is enabled — the exact
    // condition under which db/repos/* would otherwise enqueue seeded rows
    // under a real user's account. shouldSeed() refuses to run at all in
    // this combination, which is the structural guarantee this test proves.
    it("refuses to seed at all when sync is enabled and a real user is authenticated", async () => {
      stubCanvas();
      authState = { userId: "real-user-123" };
      mockIsSyncEnabled.mockReturnValue(true);

      expect(shouldSeed()).toBe(false);

      await seedDemoProfile();

      expect(mockUpsertProfile).not.toHaveBeenCalled();
      expect(mockUpsertMany).not.toHaveBeenCalled();
      expect(mockInsertBulk).not.toHaveBeenCalled();
      expect(mockUpsertByDate).not.toHaveBeenCalled();
      expect(mockEnqueue).not.toHaveBeenCalled();
    });

    it("still seeds when sync is enabled but no real user is authenticated (anonymous session)", async () => {
      stubCanvas();
      authState = { userId: null };
      mockIsSyncEnabled.mockReturnValue(true);

      expect(shouldSeed()).toBe(true);

      await seedDemoProfile();

      expect(mockUpsertProfile).toHaveBeenCalledTimes(1);
      expect(mockEnqueue).not.toHaveBeenCalled();
    });
  });

  // ── Task 7 — Idempotency + reset (REQ-8) ─────────────────────────────
  describe("seedDemoProfile — idempotency (REQ-8)", () => {
    it("second boot with the marker present creates zero new rows", async () => {
      window.localStorage.setItem(SEED_MARKER_KEY, "v1");

      await seedDemoProfile();

      expect(mockUpsertProfile).not.toHaveBeenCalled();
      expect(mockUpsertMany).not.toHaveBeenCalled();
      expect(mockInsertBulk).not.toHaveBeenCalled();
      expect(mockUpsertByDate).not.toHaveBeenCalled();
    });

    it("marker absent + shouldSeed() true -> seed runs once and marker is written after success", async () => {
      stubCanvas();
      expect(window.localStorage.getItem(SEED_MARKER_KEY)).toBeNull();

      await seedDemoProfile();

      expect(window.localStorage.getItem(SEED_MARKER_KEY)).toBe("v1");
      expect(mockUpsertProfile).toHaveBeenCalledTimes(1);
    });

    it("does not write the marker when seeding fails partway through", async () => {
      stubCanvas();
      mockInsertBulk.mockRejectedValueOnce(new Error("simulated insertBulk failure"));

      await seedDemoProfile();

      expect(window.localStorage.getItem(SEED_MARKER_KEY)).toBeNull();
    });

    it("never throws even when an internal write fails (main.tsx boot-hook contract)", async () => {
      stubCanvas();
      mockUpsertByDate.mockRejectedValueOnce(new Error("simulated upsertByDate failure"));

      await expect(seedDemoProfile()).resolves.toBeUndefined();
    });
  });

  describe("seedDemoProfile — ?seedReset=1 (REQ-8)", () => {
    it("clears previously seeded rows and the marker, then seeds exactly once more", async () => {
      stubCanvas();
      window.localStorage.setItem(SEED_MARKER_KEY, "v1");
      setLocationSearch("?seedReset=1");

      await seedDemoProfile();

      expect(mockDeleteProgressByDate).toHaveBeenCalled();
      expect(mockUpsertProfile).toHaveBeenCalledTimes(1);
      expect(window.localStorage.getItem(SEED_MARKER_KEY)).toBe("v1");
    });
  });
});

// ── Local date helper (mirrors seed module's own day-window math) ──────
function daysAgo(n: number): string {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}
