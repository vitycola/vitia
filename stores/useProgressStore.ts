import * as progressRepo from "@/db/repos/progress";
import type { ProgressEntryWithPhotos, ProgressInput } from "@/db/repos/progress";
import { useProfileStore } from "@/stores/useProfileStore";
import { create } from "zustand";

/** Keep the profile weight in line with the latest weigh-in; never fails the progress write. */
async function syncProfileWeight(): Promise<void> {
  try {
    await useProfileStore.getState().syncWeightFromProgress();
  } catch (err) {
    console.error("[progressStore] syncWeightFromProgress failed", err);
  }
}

// ── Dashboard range selection ──────────────────────────────────────────
// Drives the Calorías chart's data range and historical overlay window
// (see useCalorieDashboard / CalorieDashboardCard), the Peso chart's data
// range and historical overlay window (see useWeightDashboard /
// WeightCard), the % Grasa chart's data range and historical overlay
// window (see useBodyFatDashboard / BodyFatCard), AND the Medidas chart's
// data range and historical overlay window (see useMeasurementsDashboard /
// MeasurementsCard).
export type DashboardRange = "week" | "month" | "3month";

// ── Store shape ────────────────────────────────────────────────────────
interface ProgressState {
  /** The progress_entries record (with photos) for the last loaded date, or null. */
  current: ProgressEntryWithPhotos | null;
  /** Segmented filter selection on Profile > Progreso — drives the Calorías, Peso, % Grasa, and Medidas chart/overlay. */
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
   * Upsert only the weight of the entry for `date`, preserving its other
   * measurements, notes and photos (used by Configuración so the profile
   * weight is also recorded as a weigh-in).
   */
  recordWeight: (date: string, weightKg: number) => Promise<void>;
  /**
   * Update the selected dashboard range. `useCalorieDashboard`,
   * `useWeightDashboard`, `useBodyFatDashboard`, and
   * `useMeasurementsDashboard` all react to this and refetch their
   * windows.
   */
  setRange: (range: DashboardRange) => void;
}

export const useProgressStore = create<ProgressState & ProgressActions>()((set, get) => ({
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
    await syncProfileWeight();
  },

  recordWeight: async (date: string, weightKg: number) => {
    const existing = await progressRepo.getByDate(date);
    // Already recorded: avoid rewriting photos and enqueuing a redundant sync op.
    if (existing?.weightKg === weightKg) return;
    await progressRepo.upsertByDate({
      date,
      weightKg,
      neckCm: existing?.neckCm ?? null,
      chestCm: existing?.chestCm ?? null,
      armCm: existing?.armCm ?? null,
      waistCm: existing?.waistCm ?? null,
      hipCm: existing?.hipCm ?? null,
      thighCm: existing?.thighCm ?? null,
      notes: existing?.notes ?? null,
      photos: (existing?.photos ?? []).map((p) => ({ blob: p.blob, mimeType: p.mimeType })),
    });
    const current = await progressRepo.getByDate(date);
    if (get().current?.date === date) set({ current });
    await syncProfileWeight();
  },

  deleteEntry: async (date: string) => {
    await progressRepo.deleteByDate(date);
    set({ current: null });
    await syncProfileWeight();
  },

  setRange: (range: DashboardRange) => {
    set({ selectedRange: range });
  },
}));
