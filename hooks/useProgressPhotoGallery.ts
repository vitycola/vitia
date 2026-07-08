import * as progressRepo from "@/db/repos/progress";
import type { ProgressEntryWithPhotos, ProgressPhotoView } from "@/db/repos/progress";
import { formatMonthLabel } from "@/lib/date";
import { useEffect, useMemo, useState } from "react";

// ---------------------------------------------------------------------------
// Phase 0 decision record (sdd/progress-photos-gallery)
// ---------------------------------------------------------------------------
// Decision: the gallery's "all photos" fetch (no specific range selected by
// the user) reuses `progressRepo.getPhotosInRange(from, to)` with a sentinel
// wide date range ("0000-01-01".."9999-12-31") rather than adding a second,
// dedicated repo method (e.g. `getAllWithPhotos()`).
//
// Alternatives considered:
//   (a) Sentinel wide range reusing getPhotosInRange [CHOSEN]
//   (b) A separate no-arg getAllWithPhotos() method
//
// Rationale: there is exactly one call site that needs "all photos" (this
// hook). Adding a second method to three files (db/repositories/progress.ts,
// src/db/dexie-adapter.ts, db/repos/progress.ts) for a single caller doubles
// the surface area of the Range+Photos Query Contract for no behavioral
// benefit — both backends already implement inclusive date-range queries via
// plain string comparison (`between`, Dexie `.between`), so a maximal range
// is a correct, cheap way to express "no bound". This was a deliberate,
// fresh-precedent choice (no existing sentinel-range or getAll* convention
// existed in this codebase before this feature).
export const ALL_PHOTOS_RANGE = { from: "0000-01-01", to: "9999-12-31" } as const;

/** A single photo, flattened out of its parent entry, with a live object URL. */
export interface GalleryItem {
  entry: ProgressEntryWithPhotos;
  photo: ProgressPhotoView;
  url: string;
}

export interface GalleryMonth {
  /** YYYY-MM grouping key. */
  key: string;
  /** es-AR "Month Year" label, e.g. "Julio 2026". */
  label: string;
  /** Items within this month, newest-first. */
  items: GalleryItem[];
}

export interface ProgressPhotoGalleryVM {
  months: GalleryMonth[];
  isLoading: boolean;
}

/**
 * Fetch+shape hook for the progress-photos gallery. Mirrors the fetch
 * pattern of hooks/useWeightDashboard.ts (local hook, not a Zustand slice):
 * calls progressRepo.getPhotosInRange with the ALL_PHOTOS_RANGE sentinel
 * (Phase 0 decision above), flattens entries into per-photo GalleryItems (in
 * `position` order per entry), groups them by calendar month (newest month
 * first, newest item first within a month), and owns the object-URL
 * lifecycle: every URL created for a fetched photo is revoked on unmount or
 * refetch (spec: Object-URL Lifecycle — gallery-unmount scenario).
 */
export function useProgressPhotoGallery(): ProgressPhotoGalleryVM {
  const [entries, setEntries] = useState<ProgressEntryWithPhotos[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);

    async function fetchEntries() {
      const result = await progressRepo.getPhotosInRange(
        ALL_PHOTOS_RANGE.from,
        ALL_PHOTOS_RANGE.to
      );
      if (cancelled) return;
      setEntries(result);
      setIsLoading(false);
    }

    void fetchEntries();

    return () => {
      cancelled = true;
    };
  }, []);

  // Object-URL lifecycle: create one URL per fetched photo, revoke all of
  // them when entries change or the hook unmounts. Kept in a separate effect
  // (rather than derived in useMemo) because URL.createObjectURL/revokeObjectURL
  // are side effects, not pure derivations — mirrors progress.tsx's existing
  // create/revoke pattern (lines ~47-57).
  const [urlsByPhotoId, setUrlsByPhotoId] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    const created = new Map<string, string>();
    for (const entry of entries) {
      for (const photo of entry.photos) {
        created.set(photo.id, URL.createObjectURL(photo.blob));
      }
    }
    setUrlsByPhotoId(created);

    return () => {
      for (const url of created.values()) {
        URL.revokeObjectURL(url);
      }
    };
  }, [entries]);

  const months = useMemo(() => {
    if (entries.length === 0 || urlsByPhotoId.size === 0) return [];

    // Group by month first, at the ENTRY level (entries arrive date-ascending
    // per getPhotosInRange), then reverse entry order within each month to
    // get newest-entry-first — but keep each entry's own photos in position
    // order (multi-photo days must not have their photos reordered).
    const entriesByMonth = new Map<string, ProgressEntryWithPhotos[]>();
    for (const entry of entries) {
      const key = entry.date.slice(0, 7);
      const group = entriesByMonth.get(key);
      if (group) {
        group.push(entry);
      } else {
        entriesByMonth.set(key, [entry]);
      }
    }

    const monthKeys = [...entriesByMonth.keys()].sort((a, b) => b.localeCompare(a));

    return monthKeys.map((key) => {
      const monthEntries = entriesByMonth.get(key) ?? [];
      const newestFirst = [...monthEntries].reverse();

      const items: GalleryItem[] = [];
      for (const entry of newestFirst) {
        const sortedPhotos = [...entry.photos].sort((a, b) => a.position - b.position);
        for (const photo of sortedPhotos) {
          const url = urlsByPhotoId.get(photo.id);
          if (!url) continue;
          items.push({ entry, photo, url });
        }
      }

      return { key, label: formatMonthLabel(key), items };
    });
  }, [entries, urlsByPhotoId]);

  return { months, isLoading };
}
