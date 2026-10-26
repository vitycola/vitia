/** @jest-environment jsdom */
import { act, renderHook } from "@testing-library/react";

// Minimal real zustand stores: the real ones drag in Dexie, auth and sync.
jest.mock("@/stores/useGoalHistoryStore", () => {
  const { create } = require("zustand");
  return { useGoalHistoryStore: create(() => ({ entries: [] })) };
});
jest.mock("@/stores/useProfileStore", () => {
  const { create } = require("zustand");
  return { useProfileStore: create(() => ({ profile: null })) };
});

import { useGoalFor } from "@/hooks/useGoalFor";
import { useGoalHistoryStore } from "@/stores/useGoalHistoryStore";
import { useProfileStore } from "@/stores/useProfileStore";

const snapshot = (calorieGoal: number) => ({
  calorieGoal,
  proteinGoalG: 150,
  carbsGoalG: 250,
  fatGoalG: 70,
  useManualGoals: false,
});
const entry = (effectiveFrom: string, calorieGoal: number) => ({
  effectiveFrom,
  ...snapshot(calorieGoal),
});

const setHistory = (entries: unknown[]) => useGoalHistoryStore.setState({ entries } as never);
const setProfile = (profile: unknown) => useProfileStore.setState({ profile } as never);

beforeEach(() => {
  setHistory([]);
  setProfile(null);
});

describe("useGoalFor", () => {
  it("resolves different goals before and after a change", () => {
    setHistory([entry("2026-10-01", 1700), entry("2026-10-24", 1500)]);

    const before = renderHook(() => useGoalFor("2026-10-23"));
    const after = renderHook(() => useGoalFor("2026-10-24"));

    expect(before.result.current?.calorieGoal).toBe(1700);
    expect(after.result.current?.calorieGoal).toBe(1500);
  });

  it("falls back to the live profile with empty history, and null with neither", () => {
    const { result } = renderHook(() => useGoalFor("2026-10-23"));
    expect(result.current).toBeNull();

    act(() => setProfile(snapshot(1900)));
    expect(result.current?.calorieGoal).toBe(1900);
  });

  it("re-renders when the history entries change", () => {
    setHistory([entry("2026-10-01", 1700)]);
    const { result } = renderHook(() => useGoalFor("2026-10-25"));
    expect(result.current?.calorieGoal).toBe(1700);

    act(() => setHistory([entry("2026-10-01", 1700), entry("2026-10-24", 1500)]));
    expect(result.current?.calorieGoal).toBe(1500);
  });

  it("returns a stable reference while nothing changes", () => {
    setHistory([entry("2026-10-01", 1700)]);
    const { result, rerender } = renderHook(() => useGoalFor("2026-10-25"));
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });
});
