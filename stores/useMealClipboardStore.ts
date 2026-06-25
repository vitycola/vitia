import type { MealEntry } from "@/db/schema";
import type { MealType } from "@/types";
import { create } from "zustand";

export interface ClipboardMeal {
  mealType: MealType;
  entries: MealEntry[];
}

interface MealClipboardState {
  clipboardMeal: ClipboardMeal | null;
}

interface MealClipboardActions {
  copyMeal: (entries: MealEntry[], mealType: MealType) => void;
  clearClipboard: () => void;
}

export const useMealClipboardStore = create<MealClipboardState & MealClipboardActions>()((set) => ({
  clipboardMeal: null,
  copyMeal: (entries, mealType) => set({ clipboardMeal: { mealType, entries: [...entries] } }),
  clearClipboard: () => set({ clipboardMeal: null }),
}));
