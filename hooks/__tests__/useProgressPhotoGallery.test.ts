/** @jest-environment jsdom */
/**
 * Unit tests for useProgressPhotoGallery — fetch+shape hook for the
 * progress-photos gallery. Mocks the repo so only hook wiring (fetch,
 * month-grouping, object-URL lifecycle) is under test.
 *
 * Spec: sdd/progress-photos-gallery — "Gallery Route Rendering" (month
 * grouping, most-recent-first), "Object-URL Lifecycle" (revoke on unmount).
 * Design: hooks/useProgressPhotoGallery.ts, ALL_PHOTOS_RANGE sentinel.
 */
import { act, renderHook, waitFor } from "@testing-library/react";

jest.mock("@/db/repos/progress", () => ({
  getPhotosInRange: jest.fn(),
}));

import * as progressRepo from "@/db/repos/progress";
import { ALL_PHOTOS_RANGE, useProgressPhotoGallery } from "../useProgressPhotoGallery";

const mockGetPhotosInRange = progressRepo.getPhotosInRange as jest.Mock;

function makePhotoBlob(): Blob {
  return new Blob([new Uint8Array([1, 2, 3])], { type: "image/png" });
}

let createdUrls: string[];
let revokedUrls: string[];

beforeEach(() => {
  mockGetPhotosInRange.mockReset();
  createdUrls = [];
  revokedUrls = [];
  let counter = 0;
  globalThis.URL.createObjectURL = jest.fn(() => {
    const url = `blob:mock-${counter++}`;
    createdUrls.push(url);
    return url;
  });
  globalThis.URL.revokeObjectURL = jest.fn((url: string) => {
    revokedUrls.push(url);
  });
});

describe("useProgressPhotoGallery", () => {
  it("fetches using the ALL_PHOTOS_RANGE sentinel", async () => {
    mockGetPhotosInRange.mockResolvedValue([]);

    const { result } = renderHook(() => useProgressPhotoGallery());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockGetPhotosInRange).toHaveBeenCalledWith(ALL_PHOTOS_RANGE.from, ALL_PHOTOS_RANGE.to);
  });

  it("returns an empty months array when there are no photos", async () => {
    mockGetPhotosInRange.mockResolvedValue([]);

    const { result } = renderHook(() => useProgressPhotoGallery());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.months).toEqual([]);
  });

  it("groups items by month, newest month first", async () => {
    mockGetPhotosInRange.mockResolvedValue([
      {
        date: "2026-06-01",
        weightKg: 80,
        bodyFatPct: null,
        waistCm: null,
        photos: [{ id: "p1", entryId: "e1", blob: makePhotoBlob(), mimeType: "image/png", position: 0 }],
      },
      {
        date: "2026-07-01",
        weightKg: 78,
        bodyFatPct: null,
        waistCm: null,
        photos: [{ id: "p2", entryId: "e2", blob: makePhotoBlob(), mimeType: "image/png", position: 0 }],
      },
    ]);

    const { result } = renderHook(() => useProgressPhotoGallery());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.months.map((m) => m.key)).toEqual(["2026-07", "2026-06"]);
    expect(result.current.months[0].label).toBe("Julio 2026");
    expect(result.current.months[1].label).toBe("Junio 2026");
  });

  it("orders items within a month newest-first", async () => {
    mockGetPhotosInRange.mockResolvedValue([
      {
        date: "2026-07-01",
        weightKg: 80,
        bodyFatPct: null,
        waistCm: null,
        photos: [{ id: "p1", entryId: "e1", blob: makePhotoBlob(), mimeType: "image/png", position: 0 }],
      },
      {
        date: "2026-07-15",
        weightKg: 78,
        bodyFatPct: null,
        waistCm: null,
        photos: [{ id: "p2", entryId: "e2", blob: makePhotoBlob(), mimeType: "image/png", position: 0 }],
      },
    ]);

    const { result } = renderHook(() => useProgressPhotoGallery());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.months).toHaveLength(1);
    expect(result.current.months[0].items.map((i) => i.entry.date)).toEqual([
      "2026-07-15",
      "2026-07-01",
    ]);
  });

  it("flattens multiple photos per entry in position order", async () => {
    mockGetPhotosInRange.mockResolvedValue([
      {
        date: "2026-07-01",
        weightKg: 80,
        bodyFatPct: null,
        waistCm: null,
        photos: [
          { id: "p2", entryId: "e1", blob: makePhotoBlob(), mimeType: "image/png", position: 1 },
          { id: "p1", entryId: "e1", blob: makePhotoBlob(), mimeType: "image/png", position: 0 },
        ],
      },
    ]);

    const { result } = renderHook(() => useProgressPhotoGallery());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const items = result.current.months[0].items;
    expect(items.map((i) => i.photo.id)).toEqual(["p1", "p2"]);
  });

  it("creates an object URL per photo item", async () => {
    mockGetPhotosInRange.mockResolvedValue([
      {
        date: "2026-07-01",
        weightKg: 80,
        bodyFatPct: null,
        waistCm: null,
        photos: [{ id: "p1", entryId: "e1", blob: makePhotoBlob(), mimeType: "image/png", position: 0 }],
      },
    ]);

    const { result } = renderHook(() => useProgressPhotoGallery());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.months[0].items[0].url).toBe(createdUrls[0]);
  });

  it("revokes all created object URLs on unmount", async () => {
    mockGetPhotosInRange.mockResolvedValue([
      {
        date: "2026-07-01",
        weightKg: 80,
        bodyFatPct: null,
        waistCm: null,
        photos: [
          { id: "p1", entryId: "e1", blob: makePhotoBlob(), mimeType: "image/png", position: 0 },
          { id: "p2", entryId: "e1", blob: makePhotoBlob(), mimeType: "image/png", position: 1 },
        ],
      },
    ]);

    const { result, unmount } = renderHook(() => useProgressPhotoGallery());

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(createdUrls).toHaveLength(2);

    act(() => {
      unmount();
    });

    expect(revokedUrls.sort()).toEqual([...createdUrls].sort());
  });
});
