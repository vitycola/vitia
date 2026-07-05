import { goalEditorSchema } from "@/lib/goalSchema";
import { zodResolver } from "@hookform/resolvers/zod";
import { type UseFormRegisterReturn, useForm } from "react-hook-form";
import type { z } from "zod";

type FormValues = z.infer<typeof goalEditorSchema>;

export interface GoalEditorGoals {
  calorieGoal: number;
  proteinGoalG: number;
  carbsGoalG: number;
  fatGoalG: number;
}

interface GoalEditorSheetProps {
  /** Seed values shown when the sheet opens (current store goals). */
  initial: GoalEditorGoals;
  /** Called with validated, coerced numeric goals when the user confirms. */
  onSave: (goals: GoalEditorGoals) => void;
  /** Dismiss without saving. */
  onClose: () => void;
}

/**
 * Reusable bottom-sheet for editing the four daily goal values (calories +
 * 3 macros). Presentational and stateless w.r.t. visibility — the parent
 * conditionally renders it, mirroring the `MealPicker` pattern. Both entry
 * points (Day-screen pencil, Plan-screen button) render the same component
 * seeded with the same profile goals, keeping the two copies in sync.
 *
 * Validation is intentionally free-form between macros and calories (no
 * cross-field sum check) — see `lib/goalSchema.ts`.
 */
export function GoalEditorSheet({ initial, onSave, onClose }: GoalEditorSheetProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(goalEditorSchema),
    mode: "onSubmit",
    defaultValues: initial,
  });

  function onSubmit(data: FormValues) {
    onSave({
      calorieGoal: data.calorieGoal,
      proteinGoalG: data.proteinGoalG,
      carbsGoalG: data.carbsGoalG,
      fatGoalG: data.fatGoalG,
    });
  }

  return (
    // biome-ignore lint/a11y/useSemanticElements: custom bottom-sheet modal, not a native <dialog>
    <div
      role="dialog"
      aria-label="Editar objetivos"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center"
    >
      <div className="w-full max-w-sm rounded-t-2xl bg-white p-4 sm:rounded-2xl">
        <h2 className="mb-3 text-sm font-semibold text-gray-900">Editar objetivos</h2>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3">
          <GoalField
            id="calorieGoal"
            label="Calorías (kcal)"
            register={register("calorieGoal")}
            error={errors.calorieGoal?.message}
          />
          <GoalField
            id="proteinGoalG"
            label="Proteínas (g)"
            register={register("proteinGoalG")}
            error={errors.proteinGoalG?.message}
          />
          <GoalField
            id="carbsGoalG"
            label="Carbohidratos (g)"
            register={register("carbsGoalG")}
            error={errors.carbsGoalG?.message}
          />
          <GoalField
            id="fatGoalG"
            label="Grasas (g)"
            register={register("fatGoalG")}
            error={errors.fatGoalG?.message}
          />

          <p className="text-xs text-gray-400">
            Los macros no necesitan sumar exacto a las calorías
          </p>

          <div className="mt-2 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-600 transition-colors hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex-1 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground transition-colors hover:opacity-90"
            >
              Guardar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function GoalField({
  id,
  label,
  register,
  error,
}: {
  id: string;
  label: string;
  register: UseFormRegisterReturn;
  error?: string;
}) {
  return (
    <label htmlFor={id} className="flex flex-col gap-1">
      <span className="text-sm text-gray-800">{label}</span>
      <input
        id={id}
        type="number"
        inputMode="decimal"
        className="rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900"
        {...register}
      />
      {error && <span className="text-xs text-red-500">{error}</span>}
    </label>
  );
}
