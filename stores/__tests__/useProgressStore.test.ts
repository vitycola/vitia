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
  deleteByDate: jest.fn(),
}));

// The profile store pulls in db/client (import.meta); only the sync seam matters here.
jest.mock("@/stores/useProfileStore", () => ({
  useProfileStore: { getState: jest.fn() },
}));

import * as progressRepo from "@/db/repos/progress";
import { useProfileStore } from "@/stores/useProfileStore";
// Imported after mocks so the store module picks up the mocked deps.
import { useProgressStore } from "@/stores/useProgressStore";

const mockedGetByDate = progressRepo.getByDate as jest.MockedFunction<
  typeof progressRepo.getByDate
>;
const mockedUpsertByDate = progressRepo.upsertByDate as jest.MockedFunction<
  typeof progressRepo.upsertByDate
>;
const mockedDeleteByDate = progressRepo.deleteByDate as jest.MockedFunction<
  typeof progressRepo.deleteByDate
>;

const syncWeightFromProgress = jest.fn().mockResolvedValue(false);

const sampleEntry = {
  id: "entry-1",
  userId: null,
  date: "2026-01-01",
  weightKg: 70,
  neckCm: null,
  chestCm: null,
  armCm: null,
  waistCm: null,
  hipCm: null,
  thighCm: null,
  bodyFatPct: null,
  notes: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  photos: [],
};

describe("useProgressStore", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    syncWeightFromProgress.mockResolvedValue(false);
    (useProfileStore.getState as jest.Mock).mockReturnValue({ syncWeightFromProgress });
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

  describe("deleteEntry", () => {
    it("calls deleteByDate and sets current to null without re-fetching", async () => {
      useProgressStore.setState({ current: sampleEntry });
      mockedDeleteByDate.mockResolvedValue(undefined);

      await useProgressStore.getState().deleteEntry("2026-01-01");

      expect(mockedDeleteByDate).toHaveBeenCalledWith("2026-01-01");
      expect(useProgressStore.getState().current).toBeNull();
      expect(mockedGetByDate).not.toHaveBeenCalled();
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

  describe("profile weight sync (issue #82)", () => {
    it("saveEntry asks the profile store to sync the latest weigh-in", async () => {
      mockedUpsertByDate.mockResolvedValue(sampleEntry);
      mockedGetByDate.mockResolvedValue(sampleEntry);

      await useProgressStore
        .getState()
        .saveEntry({ date: "2026-01-05", weightKg: 81.2, photos: [] });

      expect(syncWeightFromProgress).toHaveBeenCalledTimes(1);
    });

    it("deleteEntry asks the profile store to sync (fallback to previous weigh-in)", async () => {
      mockedDeleteByDate.mockResolvedValue(undefined);

      await useProgressStore.getState().deleteEntry("2026-01-09");

      expect(syncWeightFromProgress).toHaveBeenCalledTimes(1);
    });

    it("does not fail the save when the profile sync throws", async () => {
      const spy = jest.spyOn(console, "error").mockImplementation(() => {});
      mockedUpsertByDate.mockResolvedValue(sampleEntry);
      mockedGetByDate.mockResolvedValue(sampleEntry);
      syncWeightFromProgress.mockRejectedValue(new Error("boom"));

      await expect(
        useProgressStore.getState().saveEntry({ date: "2026-01-01", weightKg: 70, photos: [] })
      ).resolves.toBeUndefined();
      spy.mockRestore();
    });
  });

  describe("recordWeight", () => {
    it("upserts the weight preserving other measurements, notes and photos", async () => {
      const blob = new Blob(["x"]);
      mockedGetByDate.mockResolvedValue({
        ...sampleEntry,
        weightKg: 70,
        waistCm: 80,
        neckCm: 38,
        chestCm: 100,
        armCm: 35,
        hipCm: 95,
        thighCm: 58,
        notes: "after trip",
        photos: [{ id: "ph1", entryId: "entry-1", blob, mimeType: "image/png", position: 0 }],
      });
      mockedUpsertByDate.mockResolvedValue(sampleEntry);

      await useProgressStore.getState().recordWeight("2026-01-01", 83);

      expect(mockedUpsertByDate).toHaveBeenCalledWith(
        expect.objectContaining({
          date: "2026-01-01",
          weightKg: 83,
          waistCm: 80,
          neckCm: 38,
          chestCm: 100,
          armCm: 35,
          hipCm: 95,
          thighCm: 58,
          notes: "after trip",
          photos: [{ blob, mimeType: "image/png" }],
        })
      );
      expect(syncWeightFromProgress).toHaveBeenCalled();
    });

    it("does not write when the entry already has that weight", async () => {
      mockedGetByDate.mockResolvedValue({ ...sampleEntry, weightKg: 83 });

      await useProgressStore.getState().recordWeight("2026-01-01", 83);

      expect(mockedUpsertByDate).not.toHaveBeenCalled();
      expect(syncWeightFromProgress).not.toHaveBeenCalled();
    });

    it("creates a fresh entry when none exists for the date", async () => {
      mockedGetByDate.mockResolvedValue(null);
      mockedUpsertByDate.mockResolvedValue(sampleEntry);

      await useProgressStore.getState().recordWeight("2026-01-02", 75);

      expect(mockedUpsertByDate).toHaveBeenCalledWith(
        expect.objectContaining({ date: "2026-01-02", weightKg: 75, waistCm: null, photos: [] })
      );
    });
  });
});
