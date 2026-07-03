import {
  addDays,
  formatDayLabel,
  formatFullDayLabel,
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
