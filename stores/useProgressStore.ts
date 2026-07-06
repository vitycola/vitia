import * as progressRepo from "@/db/repos/progress";
import type { ProgressEntryWithPhotos, ProgressInput } from "@/db/repos/progress";
import { create } from "zustand";

// ── Dashboard range selection ──────────────────────────────────────────
// Drives the Calorías chart's data range and the historical overlay's
// window (see useCalorieDashboard / CalorieDashboardCard). Remains inert
// for the Peso, % Grasa, and Medidas placeholder cards.
export type DashboardRange = "week" | "month" | "3month";

// ── Store shape ────────────────────────────────────────────────────────
interface ProgressState {
  /** The progress_entries record (with photos) for the last loaded date, or null. */
  current: ProgressEntryWithPhotos | null;
  /** Segmented filter selection on Profile > Progreso — drives the Calorías chart/overlay. */
  selectedRange: DashboardRange;
  isLoading: boolean;
}

interface ProgressActions {
  /** Load the progress_entries record for a date into `current` (null if none). */
  loadByDate: (date: string) => Promise<void>;
  /**
   * Create or overwrite the progress_entries record for input.date, then
   * refresh `current` from the persisted result (create/edit share this
   * single write path — see design "ProgressEntrySheet component design").
   */
  saveEntry: (input: ProgressInput) => Promise<void>;
  /**
   * Delete the progress_entries record for a date, then clear `current`.
   * Does NOT re-fetch — the row no longer exists (spec: "Day screen reverts
   * to 'no record' state after deletion").
   */
  deleteEntry: (date: string) => Promise<void>;
  /**
   * Update the selected dashboard range. `useCalorieDashboard` reacts to
   * this and refetches its window; Peso/%Grasa/Medidas are unaffected.
   */
  setRange: (range: DashboardRange) => void;
}

export const useProgressStore = create<ProgressState & ProgressActions>()((set) => ({
  // ── Initial state ──────────────────────────────────────────────────
  current: null,
  selectedRange: "week",
  isLoading: false,

  // ── Actions ────────────────────────────────────────────────────────
  loadByDate: async (date: string) => {
    set({ isLoading: true });
    try {
      const current = await progressRepo.getByDate(date);
      set({ current, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  saveEntry: async (input: ProgressInput) => {
    await progressRepo.upsertByDate(input);
    const current = await progressRepo.getByDate(input.date);
    set({ current });
  },

  deleteEntry: async (date: string) => {
    await progressRepo.deleteByDate(date);
    set({ current: null });
  },

  setRange: (range: DashboardRange) => {
    set({ selectedRange: range });
  },
}));
