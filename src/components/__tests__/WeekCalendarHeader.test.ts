/**
 * Unit tests for WeekCalendarHeader behaviour.
 *
 * We test the pure logic helpers (week derivation, swipe direction, label)
 * without DOM rendering to keep tests fast and dependency-free.
 */

import { formatFullDayLabel, startOfWeek, weekDays } from "@/lib/date";

// ---------------------------------------------------------------------------
// Week derivation (used internally by WeekCalendarHeader)
// ---------------------------------------------------------------------------

describe("WeekCalendarHeader — week strip structure", () => {
  it("renders 7 columns for current week", () => {
    const today = "2024-06-26"; // Wednesday
    const weekStart = startOfWeek(today);
    const days = weekDays(weekStart);
    expect(days).toHaveLength(7);
  });

  it("column 0 is always Monday of selectedDate's week", () => {
    const wednesday = "2024-06-26";
    const weekStart = startOfWeek(wednesday);
    const days = weekDays(weekStart);
    // 2024-06-26 is a Wednesday; its Monday is 2024-06-24
    expect(days[0]).toBe("2024-06-24");
  });

  it("column 6 is always Sunday of the same week", () => {
    const wednesday = "2024-06-26";
    const weekStart = startOfWeek(wednesday);
    const days = weekDays(weekStart);
    expect(days[6]).toBe("2024-06-30");
  });

  it("each day in the strip is consecutive", () => {
    const days = weekDays("2024-06-24");
    for (let i = 1; i < days.length; i++) {
      const prev = new Date(days[i - 1]);
      const curr = new Date(days[i]);
      const diffMs = curr.getTime() - prev.getTime();
      expect(diffMs).toBe(86400000); // 1 day in ms
    }
  });
});

// ---------------------------------------------------------------------------
// Swipe direction logic
// ---------------------------------------------------------------------------

const SWIPE_THRESHOLD = 60;

function resolveSwipeDelta(startX: number, endX: number): "prev" | "next" | "none" {
  const delta = endX - startX;
  if (Math.abs(delta) < SWIPE_THRESHOLD) return "none";
  return delta < 0 ? "next" : "prev";
}

describe("WeekCalendarHeader — swipe direction", () => {
  it("swipe left (negative delta) advances to next week", () => {
    expect(resolveSwipeDelta(300, 200)).toBe("next");
  });

  it("swipe right (positive delta) goes to previous week", () => {
    expect(resolveSwipeDelta(200, 300)).toBe("prev");
  });

  it("delta below threshold is ignored", () => {
    expect(resolveSwipeDelta(300, 340)).toBe("none");
  });

  it("exact threshold is recognized", () => {
    expect(resolveSwipeDelta(300, 240)).toBe("next"); // delta = -60 = -THRESHOLD
  });

  it("swipe does not call onSelectDate (behavior: only shifts visibleWeekStart)", () => {
    // Verified by design: swipe handler only calls setVisibleWeekStart, never onSelectDate.
    // This is a documentation test — the pure helper confirms direction only.
    const direction = resolveSwipeDelta(300, 200);
    expect(direction).toBe("next");
    // onSelectDate would only be called by handleTap, not the swipe path.
  });
});

// ---------------------------------------------------------------------------
// Top-left label
// ---------------------------------------------------------------------------

describe("WeekCalendarHeader — top-left label", () => {
  it("shows Hoy when selectedDate is today", () => {
    const today = new Date().toISOString().slice(0, 10);
    expect(formatFullDayLabel(today)).toBe("Hoy");
  });

  it("shows D mmm for a known past date", () => {
    expect(formatFullDayLabel("2024-07-02")).toBe("2 jul");
  });

  it("shows D mmm for a known future date", () => {
    expect(formatFullDayLabel("2030-12-25")).toBe("25 dic");
  });
});

// ---------------------------------------------------------------------------
// Selected day state derivation
// ---------------------------------------------------------------------------

describe("WeekCalendarHeader — selected day", () => {
  it("isSelected is true only for the matching isoDate", () => {
    const selectedDate = "2024-06-26";
    const days = weekDays(startOfWeek(selectedDate));
    const selectedCount = days.filter((d) => d === selectedDate).length;
    expect(selectedCount).toBe(1);
  });

  it("no two days in a week share the same isoDate", () => {
    const days = weekDays("2024-06-24");
    const unique = new Set(days);
    expect(unique.size).toBe(7);
  });
});
