import { analyzePhoto, parseText } from "@/services/aiFood";
import { AiServiceError, ConfigurationError, OfflineError } from "@/types/aiFood";
import type { AIFoodItem } from "@/types/aiFood";
import { getConfidenceMeta } from "@/lib/aiConfidence";
import { scaleAiMacros } from "@/lib/aiMacros";
import type { MealType } from "@/types";
import { create } from "zustand";

type Step = "selection" | "input" | "results" | "confirmation";
type InputMode = "photo" | "text" | null;
type Status = "idle" | "loading" | "error";

interface AiAddFlowState {
  step: Step;
  inputMode: InputMode;
  results: AIFoodItem[];
  /** keyed by item index */
  selections: Record<number, boolean>;
  /** keyed by item index */
  quantities: Record<number, number>;
  selectedMeal: MealType | null;
  status: Status;
  error: string | null;
}

interface AiAddFlowActions {
  chooseMode: (mode: "photo" | "text") => void;
  submitPhoto: (file: File) => Promise<void>;
  submitText: (text: string) => Promise<void>;
  setResults: (items: AIFoodItem[]) => void;
  goToConfirmation: () => void;
  toggleItem: (index: number) => void;
  setQuantity: (index: number, qty: number) => void;
  setMeal: (meal: MealType) => void;
  back: () => void;
  reset: () => void;
  /** Derived: sum of scaled macros for checked items. */
  checkedMacroTotals: () => { kcal: number; protein: number; carbs: number; fat: number };
  /** Derived: scaled macros for a single item at its current quantity. */
  perItemScaledMacros: (index: number) => { kcal: number; protein: number; carbs: number; fat: number };
}

const INITIAL_STATE: AiAddFlowState = {
  step: "selection",
  inputMode: null,
  results: [],
  selections: {},
  quantities: {},
  selectedMeal: null,
  status: "idle",
  error: null,
};

const STEP_ORDER: Step[] = ["selection", "input", "results", "confirmation"];

function mapError(err: unknown): string {
  if (err instanceof OfflineError) return "IA requiere conexión a internet.";
  if (err instanceof ConfigurationError) return "El servicio de IA no está disponible.";
  if (err instanceof AiServiceError) return "No se pudo conectar con el asistente IA. Intentá de nuevo.";
  return "No se pudo conectar con el asistente IA. Intentá de nuevo.";
}

export const useAiAddFlowStore = create<AiAddFlowState & AiAddFlowActions>()((set, get) => ({
  ...INITIAL_STATE,

  chooseMode: (mode) => set({ inputMode: mode, step: "input" }),

  submitPhoto: async (file: File) => {
    set({ status: "loading", error: null });
    try {
      const items = await analyzePhoto(file);
      get().setResults(items);
      set({ step: "results", status: "idle" });
    } catch (err) {
      set({ status: "error", error: mapError(err) });
    }
  },

  submitText: async (text: string) => {
    set({ status: "loading", error: null });
    try {
      const items = await parseText(text);
      get().setResults(items);
      set({ step: "results", status: "idle" });
    } catch (err) {
      set({ status: "error", error: mapError(err) });
    }
  },

  setResults: (items: AIFoodItem[]) => {
    const selections: Record<number, boolean> = {};
    const quantities: Record<number, number> = {};
    for (let i = 0; i < items.length; i++) {
      selections[i] = getConfidenceMeta(items[i].confidence).defaultChecked;
      quantities[i] = items[i].quantity;
    }
    set({ results: items, selections, quantities });
  },

  goToConfirmation: () => set({ step: "confirmation" }),

  toggleItem: (index: number) => {
    set((state) => ({
      selections: { ...state.selections, [index]: !state.selections[index] },
    }));
  },

  setQuantity: (index: number, qty: number) => {
    set((state) => ({
      quantities: { ...state.quantities, [index]: qty },
    }));
  },

  setMeal: (meal: MealType) => set({ selectedMeal: meal }),

  back: () => {
    const { step } = get();
    const idx = STEP_ORDER.indexOf(step);
    if (idx > 0) set({ step: STEP_ORDER[idx - 1] });
  },

  reset: () => set({ ...INITIAL_STATE }),

  checkedMacroTotals: () => {
    const { results, selections, quantities } = get();
    return results.reduce(
      (acc, item, i) => {
        if (!selections[i]) return acc;
        const scaled = scaleAiMacros(item, quantities[i] ?? item.quantity);
        return {
          kcal: acc.kcal + scaled.kcal,
          protein: acc.protein + scaled.protein,
          carbs: acc.carbs + scaled.carbs,
          fat: acc.fat + scaled.fat,
        };
      },
      { kcal: 0, protein: 0, carbs: 0, fat: 0 },
    );
  },

  perItemScaledMacros: (index: number) => {
    const { results, quantities } = get();
    const item = results[index];
    if (!item) return { kcal: 0, protein: 0, carbs: 0, fat: 0 };
    return scaleAiMacros(item, quantities[index] ?? item.quantity);
  },
}));
