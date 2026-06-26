/**
 * Tests for DateNavigator component logic.
 * Layer: unit — verifies the "next button disabled at today" constraint.
 *
 * DateNavigator disables the "next day" button when selectedDate === todayISO().
 * We test the isToday derivation and the disabled state logic without DOM rendering.
 */

import { todayISO } from "@/lib/date";

// ── Helper mirroring DateNavigator's isToday logic ─────────────────────

function isNextDisabled(selectedDate: string): boolean {
  return selectedDate === todayISO();
}

// ── Tests ──────────────────────────────────────────────────────────────

describe("DateNavigator — next button disabled at today", () => {
  it("is disabled when selectedDate is today", () => {
    const today = todayISO();
    expect(isNextDisabled(today)).toBe(true);
  });

  it("is enabled when selectedDate is a known past date", () => {
    expect(isNextDisabled("2024-01-15")).toBe(false);
  });

  it("is enabled when selectedDate is another known past date", () => {
    expect(isNextDisabled("2023-06-01")).toBe(false);
  });

  it("todayISO() returns YYYY-MM-DD format", () => {
    const today = todayISO();
    expect(today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("is disabled only for the exact today ISO string", () => {
    // Any string that does NOT equal todayISO() should not be disabled.
    // Use a known past date to avoid timezone-induced flakiness.
    expect(isNextDisabled("2000-01-01")).toBe(false);
  });
});

describe("DateNavigator — date label rendering", () => {
  it("selectedDate must be a valid ISO date string", () => {
    const today = todayISO();
    const [year, month, day] = today.split("-").map(Number);
    expect(year).toBeGreaterThan(2020);
    expect(month).toBeGreaterThanOrEqual(1);
    expect(month).toBeLessThanOrEqual(12);
    expect(day).toBeGreaterThanOrEqual(1);
    expect(day).toBeLessThanOrEqual(31);
  });
});
