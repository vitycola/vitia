import {
  type GoalSnapshot,
  goalForDate,
  goalsEqual,
  isValidISODate,
  isValidRemoteGoalHistory,
  parseTimestampMs,
  pickGoals,
  resolveGoalFor,
  timestampToLocalDate,
} from "@/lib/goalHistory";

const entry = (effectiveFrom: string, calorieGoal: number) => ({ effectiveFrom, calorieGoal });

describe("goalForDate", () => {
  const history = [entry("2026-01-01", 2000), entry("2026-02-01", 2200), entry("2026-03-01", 2400)];

  it("returns the entry whose effectiveFrom equals the date", () => {
    expect(goalForDate(history, "2026-02-01")).toEqual(entry("2026-02-01", 2200));
  });

  it("returns the latest entry at or before a date between two entries", () => {
    expect(goalForDate(history, "2026-02-15")).toEqual(entry("2026-02-01", 2200));
  });

  it("returns the latest entry for a date after every entry", () => {
    expect(goalForDate(history, "2026-12-31")).toEqual(entry("2026-03-01", 2400));
  });

  it("returns the earliest entry for a date before every entry", () => {
    expect(goalForDate(history, "2025-06-01")).toEqual(entry("2026-01-01", 2000));
  });

  it("returns null for an empty history", () => {
    expect(goalForDate([], "2026-02-01")).toBeNull();
  });

  it("handles unsorted input without mutating it", () => {
    const unsorted = [
      entry("2026-03-01", 2400),
      entry("2026-01-01", 2000),
      entry("2026-02-01", 2200),
    ];
    const snapshot = [...unsorted];

    expect(goalForDate(unsorted, "2026-02-20")).toEqual(entry("2026-02-01", 2200));
    expect(goalForDate(unsorted, "2025-01-01")).toEqual(entry("2026-01-01", 2000));
    expect(unsorted).toEqual(snapshot);
  });
});

describe("goalsEqual / pickGoals", () => {
  const goals = {
    calorieGoal: 2000,
    proteinGoalG: 150,
    carbsGoalG: 200,
    fatGoalG: 60,
    useManualGoals: false,
  };

  it("is true for identical goals and false when any field differs", () => {
    expect(goalsEqual(goals, { ...goals })).toBe(true);
    expect(goalsEqual(goals, { ...goals, calorieGoal: 2001 })).toBe(false);
    expect(goalsEqual(goals, { ...goals, proteinGoalG: 151 })).toBe(false);
    expect(goalsEqual(goals, { ...goals, carbsGoalG: 201 })).toBe(false);
    expect(goalsEqual(goals, { ...goals, fatGoalG: 61 })).toBe(false);
    expect(goalsEqual(goals, { ...goals, useManualGoals: true })).toBe(false);
  });

  it("pickGoals keeps only the tracked fields", () => {
    expect(pickGoals({ ...goals, age: 30, id: 1 } as typeof goals)).toEqual(goals);
  });
});

describe("timestampToLocalDate", () => {
  it("converts an ISO timestamp to the device-local date", () => {
    // 02:00Z is still the previous day in America/Argentina/Buenos_Aires (UTC-3)
    expect(timestampToLocalDate("2026-03-10T02:00:00.000Z")).toBe("2026-03-09");
    expect(timestampToLocalDate("2026-03-10T15:00:00.000Z")).toBe("2026-03-10");
  });

  it("treats the SQLite CURRENT_TIMESTAMP format as UTC", () => {
    expect(timestampToLocalDate("2026-03-10 02:00:00")).toBe("2026-03-09");
  });

  it("returns null for an unparseable value", () => {
    expect(timestampToLocalDate("not a date")).toBeNull();
  });
});

describe("parseTimestampMs", () => {
  it("reads SQLite's zone-less timestamps as UTC, not local time", () => {
    // TZ is America/Argentina/Buenos_Aires (UTC-3): Date.parse alone would be 3h off.
    expect(parseTimestampMs("2026-03-10 12:00:00")).toBe(Date.parse("2026-03-10T12:00:00Z"));
    expect(Date.parse("2026-03-10 12:00:00")).not.toBe(Date.parse("2026-03-10T12:00:00Z"));
  });

  it("keeps ISO strings with a zone or offset as they are", () => {
    expect(parseTimestampMs("2026-03-10T12:00:00.000Z")).toBe(Date.parse("2026-03-10T12:00:00Z"));
    expect(parseTimestampMs("2026-03-10T12:00:00-03:00")).toBe(Date.parse("2026-03-10T15:00:00Z"));
  });

  it("orders a zone-less and an ISO timestamp of the same instant as equal", () => {
    expect(parseTimestampMs("2026-03-10 12:00:00")).toBe(
      parseTimestampMs("2026-03-10T12:00:00.000Z")
    );
  });

  it("is NaN for garbage", () => {
    expect(parseTimestampMs("nope")).toBeNaN();
  });
});

describe("isValidISODate", () => {
  it("accepts real dates and rejects bad formats and impossible days", () => {
    expect(isValidISODate("2026-02-28")).toBe(true);
    expect(isValidISODate("2028-02-29")).toBe(true);
    expect(isValidISODate("2026-02-30")).toBe(false);
    expect(isValidISODate("2026-13-01")).toBe(false);
    expect(isValidISODate("2026-2-1")).toBe(false);
    expect(isValidISODate("2026-02-01T00:00:00Z")).toBe(false);
    expect(isValidISODate(20260201)).toBe(false);
    expect(isValidISODate(null)).toBe(false);
  });
});

describe("isValidRemoteGoalHistory", () => {
  const valid = {
    effective_from: "2026-02-01",
    calorie_goal: 2000,
    protein_goal_g: 150,
    carbs_goal_g: 200,
    fat_goal_g: 60,
    use_manual_goals: false,
    created_at: "2026-02-01T00:00:00.000Z",
    updated_at: "2026-02-01T00:00:00.000Z",
  };

  it("accepts a well-formed row", () => {
    expect(isValidRemoteGoalHistory(valid)).toBe(true);
  });

  it.each([
    ["bad effective_from", { effective_from: "2026-02-31" }],
    ["non-string effective_from", { effective_from: 5 }],
    ["string goal", { calorie_goal: "2000" }],
    ["null goal", { protein_goal_g: null }],
    ["NaN goal", { carbs_goal_g: Number.NaN }],
    ["Infinity goal", { fat_goal_g: Number.POSITIVE_INFINITY }],
    ["negative goal", { calorie_goal: -1 }],
    ["calories above 10000", { calorie_goal: 10001 }],
    ["macro above 1000", { protein_goal_g: 1001 }],
    ["non-boolean flag", { use_manual_goals: 1 }],
    ["unparseable updated_at", { updated_at: "yesterday" }],
    ["missing updated_at", { updated_at: undefined }],
  ])("rejects %s", (_label, patch) => {
    expect(isValidRemoteGoalHistory({ ...valid, ...patch })).toBe(false);
  });
});

describe("parseTimestampMs bare offsets", () => {
  it("treats a bare +00 / -05 offset as a zone instead of appending Z", () => {
    expect(parseTimestampMs("2026-03-10 12:00:00+00")).toBe(Date.parse("2026-03-10T12:00:00Z"));
    expect(parseTimestampMs("2026-03-10 12:00:00-05")).toBe(Date.parse("2026-03-10T17:00:00Z"));
    expect(parseTimestampMs("2026-03-10T12:00:00+0530")).toBe(Date.parse("2026-03-10T06:30:00Z"));
    expect(parseTimestampMs("2026-03-10 12:00:00.123456+00")).toBe(
      Date.parse("2026-03-10T12:00:00.123Z")
    );
  });
});

describe("resolveGoalFor", () => {
  const snapshot = (calorieGoal: number, extra: Partial<GoalSnapshot> = {}): GoalSnapshot => ({
    calorieGoal,
    proteinGoalG: 150,
    carbsGoalG: 250,
    fatGoalG: 70,
    useManualGoals: false,
    ...extra,
  });
  const history = [
    { effectiveFrom: "2026-10-01", ...snapshot(1700) },
    { effectiveFrom: "2026-10-24", ...snapshot(1500) },
  ];
  const profile = snapshot(1900);

  it("keeps the old goal on the day before a change and uses the new one from its start date", () => {
    expect(resolveGoalFor(history, profile, "2026-10-23")?.calorieGoal).toBe(1700);
    expect(resolveGoalFor(history, profile, "2026-10-24")?.calorieGoal).toBe(1500);
  });

  it("resolves a date before the first entry to the earliest entry", () => {
    expect(resolveGoalFor(history, profile, "2026-09-01")?.calorieGoal).toBe(1700);
  });

  it("falls back to the live profile goals when the history is empty", () => {
    expect(resolveGoalFor([], profile, "2026-10-23")).toEqual(profile);
  });

  it("returns null with no history and no profile", () => {
    expect(resolveGoalFor([], null, "2026-10-23")).toBeNull();
  });

  it("carries every tracked field and drops extra entry fields", () => {
    const rich = [
      {
        effectiveFrom: "2026-10-01",
        ...snapshot(1700, {
          proteinGoalG: 120,
          carbsGoalG: 180,
          fatGoalG: 55,
          useManualGoals: true,
        }),
      },
    ];
    expect(resolveGoalFor(rich, profile, "2026-10-05")).toEqual({
      calorieGoal: 1700,
      proteinGoalG: 120,
      carbsGoalG: 180,
      fatGoalG: 55,
      useManualGoals: true,
    });
  });
});
