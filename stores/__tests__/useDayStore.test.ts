/**
 * repeatMeal copies the day BEFORE the selected date INTO the selected date,
 * regardless of whether the selected date is today.
 */
const mockGetByDateAndMeal = jest.fn();
const mockInsertBulk = jest.fn();
const mockGetByDate = jest.fn().mockResolvedValue([]);
jest.mock("@/db/repos/mealEntries", () => ({
  getByDateAndMeal: (...args: unknown[]) => mockGetByDateAndMeal(...args),
  insertBulk: (...args: unknown[]) => mockInsertBulk(...args),
  deleteByDateAndMeal: jest.fn(),
  getByDate: (...args: unknown[]) => mockGetByDate(...args),
}));

import { todayISO } from "@/lib/date";
import { useDayStore } from "../useDayStore";

const sourceRow = (date: string) => ({
  id: "src-1",
  date,
  mealType: "breakfast",
  foodId: "f1",
  foodName: "Avena",
  quantityG: 50,
  calories: 190,
  proteinG: 7,
  carbsG: 32,
  fatG: 3,
  loggedAt: "2026-01-01T08:00:00.000Z",
});

beforeEach(() => {
  mockGetByDateAndMeal.mockReset();
  // Echo inserted rows back, like the real repo.
  mockInsertBulk.mockReset().mockImplementation(async (rows: unknown[]) => rows);
});

describe("useDayStore.repeatMeal", () => {
  it("copies the previous day into a past selected date", async () => {
    useDayStore.setState({ selectedDate: "2026-03-10", entries: [] });
    mockGetByDateAndMeal.mockResolvedValue([sourceRow("2026-03-09")]);

    const added = await useDayStore.getState().repeatMeal("breakfast");

    expect(added).toBe(1);
    expect(mockGetByDateAndMeal).toHaveBeenCalledWith("2026-03-09", "breakfast");
    const inserted = mockInsertBulk.mock.calls[0][0];
    expect(inserted).toHaveLength(1);
    expect(inserted[0]).toMatchObject({ date: "2026-03-10", mealType: "breakfast", foodId: "f1" });
    expect(useDayStore.getState().entries).toHaveLength(1);
  });

  it("copies the previous day into a future selected date, not today", async () => {
    useDayStore.setState({ selectedDate: "2099-01-05", entries: [] });
    mockGetByDateAndMeal.mockResolvedValue([sourceRow("2099-01-04")]);

    await useDayStore.getState().repeatMeal("breakfast");

    expect(mockGetByDateAndMeal).toHaveBeenCalledWith("2099-01-04", "breakfast");
    expect(mockInsertBulk.mock.calls[0][0][0].date).toBe("2099-01-05");
  });

  it("copies yesterday into today when today is selected", async () => {
    const today = todayISO();
    useDayStore.setState({ selectedDate: today, entries: [] });
    mockGetByDateAndMeal.mockResolvedValue([sourceRow("2026-01-01")]);

    await useDayStore.getState().repeatMeal("breakfast");

    expect(mockInsertBulk.mock.calls[0][0][0].date).toBe(today);
    expect(useDayStore.getState().entries).toHaveLength(1);
  });

  it("returns 0 and inserts nothing when the source meal is empty", async () => {
    useDayStore.setState({ selectedDate: "2026-03-10", entries: [] });
    mockGetByDateAndMeal.mockResolvedValue([]);

    const added = await useDayStore.getState().repeatMeal("lunch");

    expect(added).toBe(0);
    expect(mockGetByDateAndMeal).toHaveBeenCalledWith("2026-03-09", "lunch");
    expect(mockInsertBulk).not.toHaveBeenCalled();
  });

  it("does not append optimistically when the selected date changed mid-await", async () => {
    useDayStore.setState({ selectedDate: "2026-03-10", entries: [] });
    mockGetByDateAndMeal.mockImplementation(async () => {
      useDayStore.setState({ selectedDate: "2026-03-20" });
      return [sourceRow("2026-03-09")];
    });

    const added = await useDayStore.getState().repeatMeal("breakfast");

    expect(added).toBe(1);
    expect(mockInsertBulk.mock.calls[0][0][0].date).toBe("2026-03-10");
    expect(useDayStore.getState().entries).toHaveLength(0);
  });
});

describe("useDayStore.setDate — stale responses", () => {
  it("ignores a slower earlier load that resolves after a later setDate", async () => {
    let resolveFirst: (rows: unknown[]) => void = () => {};
    const first = new Promise<unknown[]>((r) => {
      resolveFirst = r;
    });
    mockGetByDate.mockReset();
    mockGetByDate
      .mockImplementationOnce(() => first)
      .mockResolvedValueOnce([sourceRow("2026-03-11")]);

    const p1 = useDayStore.getState().setDate("2026-03-10");
    const p2 = useDayStore.getState().setDate("2026-03-11");
    await p2;
    resolveFirst([sourceRow("2026-03-10"), sourceRow("2026-03-10")]);
    await p1;

    const state = useDayStore.getState();
    expect(state.selectedDate).toBe("2026-03-11");
    expect(state.entries).toHaveLength(1);
    expect(state.entries[0].date).toBe("2026-03-11");
  });
});
