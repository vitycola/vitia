import type { ProgressEntry, UserProfile } from "@/db/schema";
import {
  type ExportRow,
  MAX_EXPORT_DAYS,
  buildExportModel,
  exportFileName,
  presetRange,
  summarize,
  targetPeriods,
  validateRange,
} from "../exportData";

const TODAY = "2026-10-23";

function progress(date: string, over: Partial<ProgressEntry> = {}): ProgressEntry {
  return {
    id: `p-${date}`,
    userId: null,
    date,
    weightKg: null,
    neckCm: null,
    chestCm: null,
    armCm: null,
    waistCm: null,
    hipCm: null,
    thighCm: null,
    bodyFatPct: null,
    notes: "secret note",
    createdAt: "",
    updatedAt: null,
    ...over,
  };
}

function totals(date: string, calories = 2000, proteinG = 100, carbsG = 200, fatG = 60) {
  return { date, calories, proteinG, carbsG, fatG };
}

const profile = {
  calorieGoal: 2200,
  proteinGoalG: 150,
  carbsGoalG: 250,
  fatGoalG: 70,
} as UserProfile;

describe("validateRange", () => {
  it("accepts a valid range", () => {
    expect(validateRange({ from: "2026-10-01", to: "2026-10-23" }, TODAY)).toBeNull();
  });

  it("accepts a single-day range", () => {
    expect(validateRange({ from: TODAY, to: TODAY }, TODAY)).toBeNull();
  });

  it("flags to before from", () => {
    expect(validateRange({ from: "2026-10-10", to: "2026-10-09" }, TODAY)).toBe("invalid_order");
  });

  it("flags future dates", () => {
    expect(validateRange({ from: "2026-10-20", to: "2026-10-24" }, TODAY)).toBe("future");
  });

  it("accepts exactly 366 days and rejects 367", () => {
    expect(MAX_EXPORT_DAYS).toBe(366);
    expect(validateRange({ from: "2025-10-23", to: TODAY }, TODAY)).toBeNull(); // 366 days
    expect(validateRange({ from: "2025-10-22", to: TODAY }, TODAY)).toBe("too_long"); // 367 days
  });
});

describe("presetRange", () => {
  it.each([7, 30, 90] as const)("ends today and spans %i days inclusive", (n) => {
    const r = presetRange(n, TODAY);
    expect(r.to).toBe(TODAY);
    expect(buildExportModel(r, [], [], null).rows).toHaveLength(n);
  });

  it("computes from = today - (N-1)", () => {
    expect(presetRange(7, TODAY)).toEqual({ from: "2026-10-17", to: TODAY });
  });
});

describe("exportFileName", () => {
  it("formats vitia-FROM_TO.ext", () => {
    const r = { from: "2026-09-24", to: TODAY };
    expect(exportFileName(r, "csv")).toBe("vitia-2026-09-24_2026-10-23.csv");
    expect(exportFileName(r, "pdf")).toBe("vitia-2026-09-24_2026-10-23.pdf");
  });
});

describe("buildExportModel", () => {
  const range = { from: "2026-10-01", to: "2026-10-03" };

  it("emits one ascending row per day, unlogged days with null values", () => {
    const m = buildExportModel(range, [totals("2026-10-02")], [], profile);
    expect(m.rows.map((r) => r.date)).toEqual(["2026-10-01", "2026-10-02", "2026-10-03"]);
    expect(m.rows[0]).toMatchObject({
      logged: false,
      caloriesKcal: null,
      proteinG: null,
      carbsG: null,
      fatG: null,
      weightKg: null,
    });
    expect(m.rows[1]).toMatchObject({ logged: true, caloriesKcal: 2000, proteinG: 100 });
    expect(m.rows[2].logged).toBe(false);
  });

  it("progress-only day is unlogged with weight set and null nutrition", () => {
    const m = buildExportModel(range, [], [progress("2026-10-01", { weightKg: 72.5 })], profile);
    expect(m.rows[0]).toMatchObject({ logged: false, caloriesKcal: null, weightKg: 72.5 });
    expect(m.hasProgress).toBe(true);
  });

  it("meals without a progress row leave body columns null", () => {
    const m = buildExportModel(range, [totals("2026-10-01")], [], profile);
    expect(m.rows[0].logged).toBe(true);
    expect(m.rows[0].weightKg).toBeNull();
    expect(m.rows[0].waistCm).toBeNull();
    expect(m.hasProgress).toBe(false);
  });

  it("keeps a missing single measurement null, never 0", () => {
    const m = buildExportModel(
      range,
      [],
      [progress("2026-10-01", { weightKg: 70, waistCm: 80 })],
      null
    );
    expect(m.rows[0]).toMatchObject({ weightKg: 70, waistCm: 80, neckCm: null, hipCm: null });
  });

  it("does not carry values forward", () => {
    const m = buildExportModel(range, [], [progress("2026-10-01", { weightKg: 70 })], null);
    expect(m.rows[1].weightKg).toBeNull();
    expect(m.rows[2].weightKg).toBeNull();
  });

  it("row targets fall back to the profile without history, null when absent", () => {
    const expected = { calorieKcal: 2200, proteinG: 150, carbsG: 250, fatG: 70 };
    const m = buildExportModel(range, [], [], profile);
    expect(m.rows.map((r) => r.targets)).toEqual([expected, expected, expected]);
    expect(buildExportModel(range, [], [], profile, []).rows[0].targets).toEqual(expected);
    expect(buildExportModel(range, [], [], null).rows.every((r) => r.targets === null)).toBe(true);
  });

  describe("goal history", () => {
    const goal = (effectiveFrom: string, calorieGoal: number) => ({
      effectiveFrom,
      calorieGoal,
      proteinGoalG: calorieGoal / 10,
      carbsGoalG: calorieGoal / 5,
      fatGoalG: calorieGoal / 30,
      useManualGoals: false,
    });
    const kcalOf = (m: ReturnType<typeof buildExportModel>) =>
      m.rows.map((r) => r.targets?.calorieKcal);
    const r = { from: "2026-10-30", to: "2026-11-02" };

    it("each day carries the goal active on that date (1700 -> 1500)", () => {
      const history = [goal("2026-01-01", 1700), goal("2026-11-01", 1500)];
      const m = buildExportModel(r, [], [], profile, history);
      expect(kcalOf(m)).toEqual([1700, 1700, 1500, 1500]);
      expect(m.rows[0].targets).toEqual({
        calorieKcal: 1700,
        proteinG: 170,
        carbsG: 340,
        fatG: 1700 / 30,
      });
    });

    it("accepts unsorted history", () => {
      const history = [goal("2026-11-01", 1500), goal("2026-01-01", 1700)];
      expect(kcalOf(buildExportModel(r, [], [], profile, history))).toEqual([
        1700, 1700, 1500, 1500,
      ]);
    });

    it("a change on the first day of the range applies to the whole range", () => {
      const history = [goal("2026-01-01", 1700), goal("2026-10-30", 1500)];
      expect(kcalOf(buildExportModel(r, [], [], profile, history))).toEqual([
        1500, 1500, 1500, 1500,
      ]);
    });

    it("a change before the range start makes the whole range 1500", () => {
      const history = [goal("2026-01-01", 1700), goal("2026-10-01", 1500)];
      expect(kcalOf(buildExportModel(r, [], [], profile, history))).toEqual([
        1500, 1500, 1500, 1500,
      ]);
    });

    it("a change after the range end leaves the whole range at 1700", () => {
      const history = [goal("2026-01-01", 1700), goal("2026-11-03", 1500)];
      expect(kcalOf(buildExportModel(r, [], [], profile, history))).toEqual([
        1700, 1700, 1700, 1700,
      ]);
    });

    it("dates before the first entry use the earliest entry", () => {
      const history = [goal("2026-11-01", 1500)];
      expect(kcalOf(buildExportModel(r, [], [], profile, history))).toEqual([
        1500, 1500, 1500, 1500,
      ]);
    });
  });

  describe("targetPeriods", () => {
    const t = (calorieKcal: number) => ({ calorieKcal, proteinG: 1, carbsG: 2, fatG: 3 });
    const row = (date: string, targets: ExportRow["targets"]) => ({ date, targets }) as ExportRow;

    it("returns one period when the goal is constant", () => {
      expect(targetPeriods([row("2026-10-01", t(1700)), row("2026-10-02", t(1700))])).toEqual([
        { from: "2026-10-01", to: "2026-10-02", targets: t(1700) },
      ]);
    });

    it("splits where the goal changes", () => {
      const rows = [
        row("2026-10-30", t(1700)),
        row("2026-10-31", t(1700)),
        row("2026-11-01", t(1500)),
      ];
      expect(targetPeriods(rows)).toEqual([
        { from: "2026-10-30", to: "2026-10-31", targets: t(1700) },
        { from: "2026-11-01", to: "2026-11-01", targets: t(1500) },
      ]);
    });

    it("returns no periods when there are no goals", () => {
      expect(targetPeriods([row("2026-10-01", null)])).toEqual([]);
    });
  });

  it("builds a full 366-day model", () => {
    const m = buildExportModel({ from: "2025-10-23", to: TODAY }, [], [], null);
    expect(m.rows).toHaveLength(366);
  });

  it("ignores data outside the range", () => {
    const m = buildExportModel(range, [totals("2026-09-01")], [progress("2026-09-01")], null);
    expect(m.rows.every((r) => !r.logged)).toBe(true);
    expect(m.hasProgress).toBe(false);
  });
});

describe("summarize", () => {
  const range = { from: "2026-10-01", to: "2026-10-10" };

  it("counts logged days only from meals; progress-only days are unlogged", () => {
    const m = buildExportModel(
      range,
      [totals("2026-10-01"), totals("2026-10-02"), totals("2026-10-03"), totals("2026-10-04")],
      [progress("2026-10-05", { weightKg: 70 }), progress("2026-10-06", { weightKg: 70 })],
      null
    );
    expect(summarize(m)).toMatchObject({ days: 10, logged: 4, unlogged: 6, hasProgress: true });
  });

  it("averages over logged days only", () => {
    const m = buildExportModel(
      range,
      [totals("2026-10-01", 2000, 100, 200, 60), totals("2026-10-02", 1000, 50, 100, 30)],
      [],
      null
    );
    expect(summarize(m).avg).toEqual({ kcal: 1500, proteinG: 75, carbsG: 150, fatG: 45 });
  });

  it("avg is null when nothing is logged", () => {
    const s = summarize(buildExportModel(range, [], [], null));
    expect(s.avg).toBeNull();
    expect(s.hasProgress).toBe(false);
  });
});

describe("timezone (America/Argentina/Buenos_Aires)", () => {
  afterEach(() => jest.useRealTimers());

  it("uses device-local today at 22:00 local", async () => {
    jest.useFakeTimers();
    // 22:00 on 2026-10-23 in Buenos Aires (UTC-3) = 01:00 UTC on the 24th
    jest.setSystemTime(new Date("2026-10-24T01:00:00Z"));
    const { todayISO } = await import("../date");
    const today = todayISO();
    expect(today).toBe("2026-10-23");
    const r = presetRange(30, today);
    expect(r.to).toBe("2026-10-23");
    expect(exportFileName(r, "csv").endsWith("_2026-10-23.csv")).toBe(true);
  });
});
