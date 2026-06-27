import { deleteByDateAndMeal, getByDateAndMeal, insertBulk } from "@/db/repos/mealEntries";
import * as mealEntriesRepo from "@/db/repos/mealEntries";
import type { MealEntryView } from "@/db/repos/mealEntries";
import type { MealEntry, NewMealEntry } from "@/db/schema";
import { addDays, todayISO } from "@/lib/date";
import { generateId } from "@/lib/id";
import { useMealClipboardStore } from "@/stores/useMealClipboardStore";
import type { MealType } from "@/types";
import { create } from "zustand";

// ── Private helpers ────────────────────────────────────────────────────

function retarget(source: MealEntry[], date: string, destMealType: MealType): NewMealEntry[] {
  return source.map((e) => ({
    id: generateId(),
    date,
    mealType: destMealType,
    foodId: e.foodId,
    foodName: e.foodName,
    quantityG: e.quantityG,
    calories: e.calories,
    proteinG: e.proteinG,
    carbsG: e.carbsG,
    fatG: e.fatG,
    loggedAt: new Date().toISOString(),
  }));
}

// ── Store shape ────────────────────────────────────────────────────────
interface DayState {
  selectedDate: string; // YYYY-MM-DD, device-local
  entries: MealEntryView[]; // entries for selectedDate, enriched with brand
  isLoading: boolean;
}

interface DayActions {
  /** Load (or reload) entries for the currently selected date. */
  loadEntries: () => Promise<void>;
  /**
   * Reload entries from the local DB.
   * Alias for loadEntries(); called by SyncService after cloud reconcile.
   */
  reload: () => Promise<void>;
  /** Change the selected date and immediately load entries for it. */
  setDate: (date: string) => Promise<void>;
  /** Navigate to the previous day. */
  goPreviousDay: () => Promise<void>;
  /**
   * Navigate to the next day.
   * Guard: selectedDate must be strictly before todayISO() — no future navigation.
   */
  goNextDay: () => Promise<void>;
  /**
   * Insert a new meal entry into SQLite and push it optimistically into
   * the in-memory entries list. No extra loadEntries() call needed.
   */
  addEntry: (input: NewMealEntry) => Promise<void>;
  /**
   * Delete a meal entry by id from SQLite and remove it optimistically
   * from the in-memory entries list.
   */
  deleteEntry: (id: string) => Promise<void>;
  /**
   * Repeat a meal: copy entries from a source date's meal into today.
   * Source defaults to the day before the selected date when sourceDate is omitted.
   * Returns the number of entries added (0 if the source meal was empty).
   */
  repeatMeal: (mealType: MealType, sourceDate?: string) => Promise<number>;
  /**
   * Paste entries from the clipboard into the specified meal type.
   * Destination meal type overrides the clipboard's original meal type.
   * Clipboard is NOT cleared after paste.
   * Returns the number of entries added (0 if clipboard is empty).
   */
  pasteEntries: (mealType: MealType) => Promise<number>;
  /**
   * Delete all entries for the given meal type on the selected date,
   * then update the in-memory list optimistically.
   */
  clearMeal: (mealType: MealType) => Promise<void>;
}

export const useDayStore = create<DayState & DayActions>()((set, get) => ({
  // ── Initial state ──────────────────────────────────────────────────
  selectedDate: todayISO(),
  entries: [],
  isLoading: false,

  // ── Actions ────────────────────────────────────────────────────────
  loadEntries: async () => {
    set({ isLoading: true });
    try {
      const entries = await mealEntriesRepo.getByDate(get().selectedDate);
      set({ entries, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  reload: async () => {
    // Alias for loadEntries() — called by SyncService after cloud reconcile
    await get().loadEntries();
  },

  setDate: async (date: string) => {
    set({ selectedDate: date, isLoading: true });
    try {
      const entries = await mealEntriesRepo.getByDate(date);
      set({ entries, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  goPreviousDay: async () => {
    const prev = addDays(get().selectedDate, -1);
    await get().setDate(prev);
  },

  goNextDay: async () => {
    const current = get().selectedDate;
    // Block navigation past today.
    if (current >= todayISO()) return;
    const next = addDays(current, 1);
    await get().setDate(next);
  },

  addEntry: async (input: NewMealEntry) => {
    const inserted = await mealEntriesRepo.insert(input);
    // Optimistic update: brand unknown at insert time — set null; loadEntries will correct it.
    set((state) => ({ entries: [...state.entries, { ...inserted, brand: null }] }));
  },

  deleteEntry: async (id: string) => {
    await mealEntriesRepo.remove(id);
    // Optimistic update: filter out the deleted entry immediately.
    set((state) => ({ entries: state.entries.filter((e) => e.id !== id) }));
  },

  repeatMeal: async (mealType: MealType, sourceDate?: string) => {
    const from = sourceDate ?? addDays(get().selectedDate, -1);
    const source = await getByDateAndMeal(from, mealType);
    if (source.length === 0) return 0;
    const destDate = todayISO();
    const toInsert = retarget(source, destDate, mealType);
    const inserted = await insertBulk(toInsert);
    if (get().selectedDate === destDate) {
      set((s) => ({ entries: [...s.entries, ...inserted.map((e) => ({ ...e, brand: null }))] }));
    }
    return inserted.length;
  },

  pasteEntries: async (mealType: MealType) => {
    const clip = useMealClipboardStore.getState().clipboardMeal;
    if (!clip || clip.entries.length === 0) return 0;
    const toInsert = retarget(clip.entries, get().selectedDate, mealType);
    const inserted = await insertBulk(toInsert);
    set((s) => ({ entries: [...s.entries, ...inserted.map((e) => ({ ...e, brand: null }))] }));
    return inserted.length;
  },

  clearMeal: async (mealType: MealType) => {
    await deleteByDateAndMeal(get().selectedDate, mealType);
    set((s) => ({ entries: s.entries.filter((e) => e.mealType !== mealType) }));
  },
}));
