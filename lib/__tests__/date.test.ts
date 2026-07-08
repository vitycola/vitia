import {
  addDays,
  enumerateDays,
  formatDayLabel,
  formatFullDayLabel,
  formatMonthLabel,
  relativeBucketLabel,
  rollingWindow,
  splitBuckets,
  startOfWeek,
  todayISO,
  weekDays,
} from "../date";

// ---------------------------------------------------------------------------
// startOfWeek
// ---------------------------------------------------------------------------

describe("startOfWeek", () => {
  // Week of 2024-06-24 (Mon) through 2024-06-30 (Sun)
  const cases: Array<[string, string, string]> = [
    ["Monday input returns same day", "2024-06-24", "2024-06-24"],
    ["Tuesday input returns previous Monday", "2024-06-25", "2024-06-24"],
    ["Wednesday input returns Monday", "2024-06-26", "2024-06-24"],
    ["Thursday input returns Monday", "2024-06-27", "2024-06-24"],
    ["Friday input returns Monday", "2024-06-28", "2024-06-24"],
    ["Saturday input returns Monday", "2024-06-29", "2024-06-24"],
    ["Sunday input returns Monday 6 days back", "2024-06-30", "2024-06-24"],
  ];

  it.each(cases)("%s", (_label, input, expected) => {
    expect(startOfWeek(input)).toBe(expected);
  });

  it("handles a Monday at the start of a month correctly", () => {
    // 2024-07-01 is a Monday
    expect(startOfWeek("2024-07-01")).toBe("2024-07-01");
  });

  it("handles a Sunday that crosses a month boundary", () => {
    // 2024-06-02 is a Sunday; Monday of that week is 2024-05-27
    expect(startOfWeek("2024-06-02")).toBe("2024-05-27");
  });
});

// ---------------------------------------------------------------------------
// weekDays
// ---------------------------------------------------------------------------

describe("weekDays", () => {
  it("returns exactly 7 dates", () => {
    expect(weekDays("2024-06-24")).toHaveLength(7);
  });

  it("first element is the Monday passed in", () => {
    expect(weekDays("2024-06-24")[0]).toBe("2024-06-24");
  });

  it("last element is the Sunday of the week", () => {
    expect(weekDays("2024-06-24")[6]).toBe("2024-06-30");
  });

  it("days are in ascending order with no gaps", () => {
    const days = weekDays("2024-06-24");
    for (let i = 1; i < days.length; i++) {
      expect(addDays(days[i - 1], 1)).toBe(days[i]);
    }
  });

  it("handles a week that crosses a month boundary", () => {
    // Week starting 2024-06-24 ends 2024-06-30; next week starts 2024-07-01
    const days = weekDays("2024-06-24");
    expect(days[6]).toBe("2024-06-30");
  });
});

// ---------------------------------------------------------------------------
// formatFullDayLabel
// ---------------------------------------------------------------------------

describe("formatFullDayLabel", () => {
  it("returns Hoy for today", () => {
    expect(formatFullDayLabel(todayISO())).toBe("Hoy");
  });

  it("returns D mmm for a past date (no leading zero, abbreviated month)", () => {
    expect(formatFullDayLabel("2024-07-02")).toBe("2 jul");
  });

  it("returns D mmm for a future date", () => {
    expect(formatFullDayLabel("2030-01-15")).toBe("15 ene");
  });

  it("does not include a year", () => {
    const label = formatFullDayLabel("2024-07-02");
    expect(label).not.toMatch(/\d{4}/);
  });

  const monthCases: Array<[string, string]> = [
    ["2024-01-05", "5 ene"],
    ["2024-02-05", "5 feb"],
    ["2024-03-05", "5 mar"],
    ["2024-04-05", "5 abr"],
    ["2024-05-05", "5 may"],
    ["2024-06-05", "5 jun"],
    ["2024-07-05", "5 jul"],
    ["2024-08-05", "5 ago"],
    ["2024-09-05", "5 sep"],
    ["2024-10-05", "5 oct"],
    ["2024-11-05", "5 nov"],
    ["2024-12-05", "5 dic"],
  ];

  it.each(monthCases)("%s → %s (correct Spanish abbreviated month)", (input, expected) => {
    expect(formatFullDayLabel(input)).toBe(expected);
  });
});

// ---------------------------------------------------------------------------
// Existing helpers — regression guard
// ---------------------------------------------------------------------------

describe("formatDayLabel (regression)", () => {
  it("still returns Hoy for today", () => {
    expect(formatDayLabel(todayISO())).toBe("Hoy");
  });

  it("still returns DD MMM for a known past date", () => {
    expect(formatDayLabel("2024-07-02")).toBe("2 Jul");
  });
});

// ---------------------------------------------------------------------------
// rollingWindow
// ---------------------------------------------------------------------------

describe("rollingWindow", () => {
  it("returns an inclusive 30-day window ending at the given today", () => {
    expect(rollingWindow(30, "2026-07-06")).toEqual({
      from: "2026-06-07",
      to: "2026-07-06",
    });
  });

  it("returns an inclusive 90-day window ending at the given today", () => {
    expect(rollingWindow(90, "2026-07-06")).toEqual({
      from: "2026-04-08",
      to: "2026-07-06",
    });
  });

  it("returns an inclusive 7-day window ending at the given today", () => {
    expect(rollingWindow(7, "2026-07-06")).toEqual({
      from: "2026-06-30",
      to: "2026-07-06",
    });
  });

  it("defaults `today` to todayISO() when omitted", () => {
    const { to } = rollingWindow(30);
    expect(to).toBe(todayISO());
  });
});

// ---------------------------------------------------------------------------
// enumerateDays
// ---------------------------------------------------------------------------

describe("enumerateDays", () => {
  it("returns an inclusive ISO date list from `from` to `to`", () => {
    expect(enumerateDays("2026-07-01", "2026-07-03")).toEqual([
      "2026-07-01",
      "2026-07-02",
      "2026-07-03",
    ]);
  });

  it("returns a single-element array when from === to", () => {
    expect(enumerateDays("2026-07-01", "2026-07-01")).toEqual(["2026-07-01"]);
  });

  it("returns the correct count for a 30-day window", () => {
    const { from, to } = rollingWindow(30, "2026-07-06");
    expect(enumerateDays(from, to)).toHaveLength(30);
  });

  it("crosses a month boundary correctly", () => {
    expect(enumerateDays("2026-06-29", "2026-07-02")).toEqual([
      "2026-06-29",
      "2026-06-30",
      "2026-07-01",
      "2026-07-02",
    ]);
  });
});

// ---------------------------------------------------------------------------
// splitBuckets
// ---------------------------------------------------------------------------

describe("splitBuckets", () => {
  it("splits a rolling 90-day window into 3 sequential 30-day buckets, oldest to newest", () => {
    const { from, to } = rollingWindow(90, "2026-07-06");
    const buckets = splitBuckets(from, to, 30);

    expect(buckets).toHaveLength(3);
    // bucket 1: days -89..-60 → 2026-04-08..2026-05-07
    expect(buckets[0]).toEqual({ from: "2026-04-08", to: "2026-05-07" });
    // bucket 2: days -59..-30 → 2026-05-08..2026-06-06
    expect(buckets[1]).toEqual({ from: "2026-05-08", to: "2026-06-06" });
    // bucket 3: days -29..0 → 2026-06-07..2026-07-06
    expect(buckets[2]).toEqual({ from: "2026-06-07", to: "2026-07-06" });
  });

  it("each bucket spans exactly `size` days inclusive", () => {
    const { from, to } = rollingWindow(90, "2026-07-06");
    const buckets = splitBuckets(from, to, 30);

    for (const bucket of buckets) {
      expect(enumerateDays(bucket.from, bucket.to)).toHaveLength(30);
    }
  });
});

// ---------------------------------------------------------------------------
// relativeBucketLabel
// ---------------------------------------------------------------------------

describe("relativeBucketLabel", () => {
  it("returns the correct label for bucket index 0 (oldest)", () => {
    expect(relativeBucketLabel(0)).toBe("Hace 61-90 días");
  });

  it("returns the correct label for bucket index 1", () => {
    expect(relativeBucketLabel(1)).toBe("Hace 31-60 días");
  });

  it("returns the correct label for bucket index 2 (most recent)", () => {
    expect(relativeBucketLabel(2)).toBe("Últimos 30 días");
  });

  it("labels are date-independent — same 3 strings regardless of todayISO()", () => {
    const labels = [0, 1, 2].map(relativeBucketLabel);
    expect(labels).toEqual(["Hace 61-90 días", "Hace 31-60 días", "Últimos 30 días"]);
  });
});

// ---------------------------------------------------------------------------
// formatMonthLabel
// ---------------------------------------------------------------------------

describe("formatMonthLabel", () => {
  it("formats a YYYY-MM-DD date into a capitalized es-AR 'Month Year' label", () => {
    expect(formatMonthLabel("2026-07-08")).toBe("Julio 2026");
  });

  it("formats a YYYY-MM (no day) input the same way", () => {
    expect(formatMonthLabel("2026-07")).toBe("Julio 2026");
  });

  it("handles January correctly (month index 0)", () => {
    expect(formatMonthLabel("2026-01-15")).toBe("Enero 2026");
  });

  it("handles December correctly (month index 11)", () => {
    expect(formatMonthLabel("2025-12-31")).toBe("Diciembre 2025");
  });
});
