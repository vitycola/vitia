/**
 * Unit tests for db/repos/progress.ts — the dispatching progress repository.
 *
 * Mocks db/client (dexieAdapter), db/repositories/progress (pure repo),
 * db/repos/profile (Navy formula inputs), and the sync plumbing so only the
 * dispatch/enqueue behavior is under test. Mirrors the mocking convention in
 * stores/__tests__/useProfileStore.test.ts and hooks/__tests__/useFavorite.test.ts
 * ("@/db/client transitively imports import.meta.url-based worker code ts-jest
 * cannot parse — mock it directly").
 */

const mockGetProfile = jest.fn();
jest.mock("@/db/repos/profile", () => ({
  getProfile: (...args: unknown[]) => mockGetProfile(...args),
}));

const mockDexieProgress = {
  getByDate: jest.fn(),
  getRange: jest.fn(),
  upsertByDate: jest.fn(),
  getPhotos: jest.fn(),
  getLatestBodyFat: jest.fn(),
};
let mockDexieAdapter: { progress: typeof mockDexieProgress } | null = null;
jest.mock("@/db/client", () => ({
  get dexieAdapter() {
    return mockDexieAdapter;
  },
}));

jest.mock("@/db/repositories/progress", () => ({
  getByDate: jest.fn(),
  getRange: jest.fn(),
  upsertByDate: jest.fn(),
}));

const mockIsSyncEnabled = jest.fn();
jest.mock("@/src/lib/supabase", () => ({
  isSyncEnabled: (...args: unknown[]) => mockIsSyncEnabled(...args),
}));

const mockEnqueue = jest.fn();
jest.mock("@/src/services/syncQueue", () => ({
  enqueue: (...args: unknown[]) => mockEnqueue(...args),
}));

let authState: { userId: string | null } = { userId: null };
jest.mock("@/src/stores/useAuthStore", () => ({
  useAuthStore: { getState: () => authState },
}));

import * as progressRepo from "@/db/repos/progress";
import * as _impl from "@/db/repositories/progress";

const mockedImplUpsert = _impl.upsertByDate as jest.Mock;
const mockedImplGetByDate = _impl.getByDate as jest.Mock;
const mockedImplGetRange = _impl.getRange as jest.Mock;

const NAVY_PROFILE = { sex: "male" as const, heightCm: 180 };

describe("db/repos/progress (dispatching repository)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDexieAdapter = null;
    authState = { userId: null };
    mockGetProfile.mockResolvedValue({ sex: "male", heightCm: 180 });
    mockIsSyncEnabled.mockReturnValue(false);
  });

  describe("routing — no dexieAdapter (OPFS/drizzle path)", () => {
    it("getByDate delegates to the pure repo", async () => {
      mockedImplGetByDate.mockResolvedValue({ id: "e1", date: "2026-01-01", photos: [] });

      const result = await progressRepo.getByDate("2026-01-01");

      expect(mockedImplGetByDate).toHaveBeenCalledWith("2026-01-01");
      expect(result).toEqual({ id: "e1", date: "2026-01-01", photos: [] });
    });

    it("getRange delegates to the pure repo", async () => {
      mockedImplGetRange.mockResolvedValue([]);
      await progressRepo.getRange("2026-01-01", "2026-01-31");
      expect(mockedImplGetRange).toHaveBeenCalledWith("2026-01-01", "2026-01-31");
    });

    it("upsertByDate resolves the profile and delegates to the pure repo with sex/heightCm", async () => {
      mockedImplUpsert.mockResolvedValue({ id: "e1", date: "2026-01-01", bodyFatPct: 16.1 });

      await progressRepo.upsertByDate({ date: "2026-01-01", neckCm: 38, waistCm: 85, photos: [] });

      expect(mockedImplUpsert).toHaveBeenCalledWith(
        expect.objectContaining({ date: "2026-01-01", neckCm: 38, waistCm: 85 }),
        NAVY_PROFILE
      );
    });

    it("upsertByDate passes null profile when no profile exists yet", async () => {
      mockGetProfile.mockResolvedValue(null);
      mockedImplUpsert.mockResolvedValue({ id: "e1", date: "2026-01-01", bodyFatPct: null });

      await progressRepo.upsertByDate({ date: "2026-01-01", weightKg: 70, photos: [] });

      expect(mockedImplUpsert).toHaveBeenCalledWith(expect.anything(), null);
    });
  });

  describe("routing — dexieAdapter active", () => {
    beforeEach(() => {
      mockDexieAdapter = { progress: mockDexieProgress };
    });

    it("getByDate delegates to the Dexie adapter, not the pure repo", async () => {
      mockDexieProgress.getByDate.mockResolvedValue({ id: "d1", date: "2026-01-02", photos: [] });

      const result = await progressRepo.getByDate("2026-01-02");

      expect(mockDexieProgress.getByDate).toHaveBeenCalledWith("2026-01-02");
      expect(mockedImplGetByDate).not.toHaveBeenCalled();
      expect(result).toEqual({ id: "d1", date: "2026-01-02", photos: [] });
    });

    it("upsertByDate delegates to the Dexie adapter with the resolved profile", async () => {
      mockDexieProgress.upsertByDate.mockResolvedValue({ id: "d1", date: "2026-01-02" });

      await progressRepo.upsertByDate({ date: "2026-01-02", neckCm: 38, waistCm: 85, photos: [] });

      expect(mockDexieProgress.upsertByDate).toHaveBeenCalledWith(
        expect.objectContaining({ date: "2026-01-02" }),
        NAVY_PROFILE
      );
      expect(mockedImplUpsert).not.toHaveBeenCalled();
    });
  });

  describe("sync enqueue — progress_entries only", () => {
    it("does not enqueue when sync is disabled", async () => {
      mockIsSyncEnabled.mockReturnValue(false);
      authState = { userId: "user-1" };
      mockedImplUpsert.mockResolvedValue({ id: "e1", date: "2026-01-01" });

      await progressRepo.upsertByDate({ date: "2026-01-01", weightKg: 70, photos: [] });

      expect(mockEnqueue).not.toHaveBeenCalled();
    });

    it("does not enqueue when sync is enabled but there is no authenticated user", async () => {
      mockIsSyncEnabled.mockReturnValue(true);
      authState = { userId: null };
      mockedImplUpsert.mockResolvedValue({ id: "e1", date: "2026-01-01" });

      await progressRepo.upsertByDate({ date: "2026-01-01", weightKg: 70, photos: [] });

      expect(mockEnqueue).not.toHaveBeenCalled();
    });

    it("enqueues a progress_entries upsert when sync is enabled and a user is authenticated", async () => {
      mockIsSyncEnabled.mockReturnValue(true);
      authState = { userId: "user-1" };
      mockedImplUpsert.mockResolvedValue({ id: "e1", date: "2026-01-01", weightKg: 70 });

      await progressRepo.upsertByDate({ date: "2026-01-01", weightKg: 70, photos: [] });

      expect(mockEnqueue).toHaveBeenCalledTimes(1);
      const [op] = mockEnqueue.mock.calls[0];
      expect(op.table).toBe("progress_entries");
      expect(op.op).toBe("upsert");
      expect(op.userId).toBe("user-1");
    });

    it("never enqueues progress_photos (photo sync is deferred)", async () => {
      mockIsSyncEnabled.mockReturnValue(true);
      authState = { userId: "user-1" };
      mockedImplUpsert.mockResolvedValue({ id: "e1", date: "2026-01-01" });

      await progressRepo.upsertByDate({
        date: "2026-01-01",
        photos: [{ blob: new Blob(["x"]), mimeType: "image/png" }],
      });

      for (const call of mockEnqueue.mock.calls) {
        expect(call[0].table).not.toBe("progress_photos");
      }
    });
  });
});
