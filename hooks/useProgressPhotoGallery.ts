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
// existed in this codebase before this feature) — recorded here per the
// Phase 0 task before any Phase 1 repo code was written.
//
// This file is populated in full in the Phase 4 commit (hook implementation
// consuming `getPhotosInRange` with this sentinel range).
export const ALL_PHOTOS_RANGE = { from: "0000-01-01", to: "9999-12-31" } as const;
