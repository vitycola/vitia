/**
 * Tests for stores/useProgressStore.ts.
 *
 * `@/db/repos/progress` transitively imports `db/client.ts`, which uses
 * `import.meta.url` (Vite-only syntax) ts-jest cannot parse. Mock it
 * directly, mirroring the pattern in useProfileStore.test.ts.
 */
jest.mock("@/db/repos/progress", () => ({
  getByDate: jest.fn(),
  upsertByDate: jest.fn(),
}));

import * as progressRepo from "@/db/repos/progress";
// Imported after mocks so the store module picks up the mocked deps.
import { useProgressStore } from "@/stores/useProgressStore";

const mockedGetByDate = progressRepo.getByDate as jest.MockedFunction<
  typeof progressRepo.getByDate
>;
const mockedUpsertByDate = progressRepo.upsertByDate as jest.MockedFunction<
  typeof progressRepo.upsertByDate
>;

const sampleEntry = {
  id: "entry-1",
  userId: null,
  date: "2026-01-01",
  weightKg: 70,
  neckCm: null,
  waistCm: null,
  hipCm: null,
  bodyFatPct: null,
  notes: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  photos: [],
};

describe("useProgressStore", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useProgressStore.setState({ current: null, selectedRange: "week", isLoading: false });
  });

  describe("loadByDate", () => {
    it("populates current with the fetched entry", async () => {
      mockedGetByDate.mockResolvedValue(sampleEntry);

      await useProgressStore.getState().loadByDate("2026-01-01");

      expect(mockedGetByDate).toHaveBeenCalledWith("2026-01-01");
      expect(useProgressStore.getState().current).toEqual(sampleEntry);
      expect(useProgressStore.getState().isLoading).toBe(false);
    });

    it("sets current to null when no record exists for the date", async () => {
      mockedGetByDate.mockResolvedValue(null);

      await useProgressStore.getState().loadByDate("2026-01-02");

      expect(useProgressStore.getState().current).toBeNull();
    });

    it("clears isLoading even when the repo call fails", async () => {
      mockedGetByDate.mockRejectedValue(new Error("boom"));

      await useProgressStore.getState().loadByDate("2026-01-03");

      expect(useProgressStore.getState().isLoading).toBe(false);
    });
  });

  describe("saveEntry", () => {
    it("calls upsertByDate and refreshes current with the result", async () => {
      mockedUpsertByDate.mockResolvedValue({ ...sampleEntry, weightKg: 72 });
      mockedGetByDate.mockResolvedValue({ ...sampleEntry, weightKg: 72 });

      await useProgressStore.getState().saveEntry({
        date: "2026-01-01",
        weightKg: 72,
        photos: [],
      });

      expect(mockedUpsertByDate).toHaveBeenCalledWith({
        date: "2026-01-01",
        weightKg: 72,
        photos: [],
      });
      expect(useProgressStore.getState().current?.weightKg).toBe(72);
    });
  });

  describe("setRange", () => {
    it("updates selectedRange only — no repo calls, no side effects", async () => {
      useProgressStore.getState().setRange("month");

      expect(useProgressStore.getState().selectedRange).toBe("month");
      expect(mockedGetByDate).not.toHaveBeenCalled();
      expect(mockedUpsertByDate).not.toHaveBeenCalled();
    });

    it("accepts all three valid ranges", () => {
      useProgressStore.getState().setRange("week");
      expect(useProgressStore.getState().selectedRange).toBe("week");

      useProgressStore.getState().setRange("3month");
      expect(useProgressStore.getState().selectedRange).toBe("3month");
    });
  });
});
