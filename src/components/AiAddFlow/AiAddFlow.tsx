import { useAiAddFlowStore } from "@/stores/useAiAddFlowStore";
import type { MealType } from "@/types";
import { useEffect } from "react";
import { useShallow } from "zustand/shallow";
import { ConfirmationScreen } from "./ConfirmationScreen";
import { InputScreen } from "./InputScreen";
import { ResultsScreen } from "./ResultsScreen";
import { SelectionScreen } from "./SelectionScreen";

interface AiAddFlowProps {
  mealType?: MealType;
}

export function AiAddFlow({ mealType }: AiAddFlowProps) {
  const { step, back, setMeal } = useAiAddFlowStore(
    useShallow((s) => ({ step: s.step, back: s.back, setMeal: s.setMeal }))
  );

  // Seed meal selector from route param when provided.
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional mount-only effect
  useEffect(() => {
    if (mealType) setMeal(mealType);
  }, []);

  return (
    <div className="flex flex-col">
      {/* Back button shown on all steps except selection */}
      {step !== "selection" && (
        <div className="flex items-center px-4 pt-3">
          <button
            type="button"
            onClick={back}
            aria-label="Volver"
            className="flex items-center gap-1 text-sm text-gray-500"
          >
            ← Volver
          </button>
        </div>
      )}

      {step === "selection" && <SelectionScreen />}
      {step === "input" && <InputScreen />}
      {step === "results" && <ResultsScreen />}
      {step === "confirmation" && <ConfirmationScreen />}
    </div>
  );
}
