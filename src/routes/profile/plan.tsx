import type { UserProfile } from "@/db/schema";
import { formatNumber } from "@/lib/formatNumber";
import { computeBMR, computeTDEE, deriveCalorieGoal, deriveMacros } from "@/lib/nutrition";
import { GoalEditorSheet } from "@/src/components/GoalEditorSheet";
import { useProfileStore } from "@/stores/useProfileStore";
import type { Goal } from "@/types";
import { useState } from "react";

const GOAL_LABELS: Record<string, string> = {
  lose_weight: "Perder peso",
  maintain: "Mantener peso",
  gain_muscle: "Ganar músculo",
};

const GOAL_PRESETS = ["lose_weight", "maintain", "gain_muscle"] as const;

interface GoalPreview {
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

/**
 * Pure preview of the targets the store would persist for `goal`, using the
 * same functions as `saveProfile`. Nothing is written.
 */
function previewForGoal(
  input: Pick<UserProfile, "age" | "heightCm" | "weightKg" | "sex" | "activityLevel">,
  goal: Goal
): GoalPreview {
  const tdee = computeTDEE(computeBMR(input), input.activityLevel);
  const kcal = deriveCalorieGoal(tdee, goal);
  const { proteinG, carbsG, fatG } = deriveMacros(kcal);
  return { kcal, proteinG, carbsG, fatG };
}

/**
 * Presentational-ish Plan view: current goal, the 3 available presets, the
 * daily macro targets, and the entry point for manually overriding goals via
 * the shared `GoalEditorSheet` (same component used by the Day-screen
 * pencil, seeded from the same profile values so both stay in sync).
 */
export function PlanRoute() {
  const { profile, saveProfile, recalcFromProfile, overrideGoals, revertToAutomaticGoals } =
    useProfileStore();
  const [recalcing, setRecalcing] = useState(false);
  const [reverting, setReverting] = useState(false);
  const [editingGoals, setEditingGoals] = useState(false);
  const [pendingGoal, setPendingGoal] = useState<Goal | null>(null);
  const [savingGoal, setSavingGoal] = useState(false);
  const [goalError, setGoalError] = useState(false);
  const [goalUpdated, setGoalUpdated] = useState(false);

  if (!profile) return null;

  async function handleRecalc() {
    setRecalcing(true);
    try {
      await recalcFromProfile();
    } finally {
      setRecalcing(false);
    }
  }

  async function handleRevert() {
    setReverting(true);
    try {
      await revertToAutomaticGoals();
    } finally {
      setReverting(false);
    }
  }

  function openGoalChange(goal: Goal) {
    if (!profile || goal === profile.goal) return;
    setGoalError(false);
    setGoalUpdated(false);
    setPendingGoal(goal);
  }

  function closeGoalChange() {
    if (savingGoal) return;
    setPendingGoal(null);
    setGoalError(false);
  }

  async function confirmGoalChange() {
    if (!profile || !pendingGoal) return;
    setSavingGoal(true);
    setGoalError(false);
    try {
      await saveProfile({
        age: profile.age,
        heightCm: profile.heightCm,
        weightKg: profile.weightKg,
        sex: profile.sex,
        activityLevel: profile.activityLevel,
        goal: pendingGoal,
      });
      setPendingGoal(null);
      setGoalUpdated(true);
    } catch {
      setGoalError(true);
    } finally {
      setSavingGoal(false);
    }
  }

  const preview = pendingGoal ? previewForGoal(profile, pendingGoal) : null;

  return (
    <div className="space-y-3">
      <section className="rounded-2xl bg-white px-4 py-4 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Objetivo actual
        </h2>
        <p className="text-sm font-medium text-gray-900">{GOAL_LABELS[profile.goal]}</p>

        <fieldset aria-label="Objetivo actual" className="mt-3 flex min-w-0 gap-2 border-0 p-0">
          {GOAL_PRESETS.map((goal) => (
            <button
              key={goal}
              type="button"
              aria-pressed={goal === profile.goal}
              onClick={() => openGoalChange(goal)}
              className={[
                "flex-1 rounded-xl border px-2 py-2 text-center text-xs font-medium transition-colors",
                goal === profile.goal
                  ? "border-accent text-accent"
                  : "border-gray-200 text-gray-500 hover:border-gray-300",
              ].join(" ")}
            >
              {GOAL_LABELS[goal]}
            </button>
          ))}
        </fieldset>

        {goalUpdated && (
          <output className="mt-3 block text-xs font-medium text-accent">
            Objetivo actualizado
          </output>
        )}
      </section>

      <section className="rounded-2xl bg-white px-4 py-4 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Objetivos diarios
        </h2>
        <div className="space-y-2">
          <PlanRow label="Objetivo calórico" value={`${formatNumber(profile.calorieGoal)} kcal`} />
          <PlanRow label="Proteínas" value={`${formatNumber(profile.proteinGoalG)} g`} />
          <PlanRow label="Carbohidratos" value={`${formatNumber(profile.carbsGoalG)} g`} />
          <PlanRow label="Grasas" value={`${formatNumber(profile.fatGoalG)} g`} />
        </div>

        {!profile.useManualGoals && (
          <button
            type="button"
            onClick={() => void handleRecalc()}
            disabled={recalcing}
            className="mt-4 flex w-full items-center justify-center rounded-xl border border-accent bg-white px-4 py-2.5 text-sm font-semibold text-accent transition-colors hover:opacity-90 disabled:opacity-50"
          >
            {recalcing ? "Recalculando…" : "Recalcular objetivos"}
          </button>
        )}

        {profile.useManualGoals && (
          <button
            type="button"
            onClick={() => void handleRevert()}
            disabled={reverting}
            className="mt-4 flex w-full items-center justify-center rounded-xl border border-accent bg-white px-4 py-2.5 text-sm font-semibold text-accent transition-colors hover:opacity-90 disabled:opacity-50"
          >
            {reverting ? "Volviendo…" : "Volver a objetivos automáticos"}
          </button>
        )}
      </section>

      <button
        type="button"
        onClick={() => setEditingGoals(true)}
        className="flex w-full items-center justify-center rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-accent-foreground transition-colors hover:opacity-90"
      >
        Configurar plan personalizado
      </button>

      {pendingGoal && preview && (
        // biome-ignore lint/a11y/useSemanticElements: custom bottom-sheet modal, not a native <dialog>
        <div
          role="dialog"
          aria-label="Cambiar objetivo"
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center"
        >
          <div className="w-full max-w-sm rounded-t-2xl bg-white p-4 sm:rounded-2xl">
            <h2 className="mb-1 text-sm font-semibold text-gray-900">Cambiar objetivo</h2>
            <p className="mb-3 text-xs text-gray-500">
              {GOAL_LABELS[profile.goal]} → {GOAL_LABELS[pendingGoal]}
            </p>

            <div className="grid grid-cols-3 gap-y-1 text-sm">
              <span />
              <span className="text-right text-xs text-gray-400">Actual</span>
              <span className="text-right text-xs text-gray-400">Nuevo</span>
              <PreviewRow
                label="Calorías"
                current={`${formatNumber(profile.calorieGoal)} kcal`}
                next={`${formatNumber(preview.kcal)} kcal`}
              />
              <PreviewRow
                label="Proteínas"
                current={`${formatNumber(profile.proteinGoalG)} g`}
                next={`${formatNumber(preview.proteinG)} g`}
              />
              <PreviewRow
                label="Carbohidratos"
                current={`${formatNumber(profile.carbsGoalG)} g`}
                next={`${formatNumber(preview.carbsG)} g`}
              />
              <PreviewRow
                label="Grasas"
                current={`${formatNumber(profile.fatGoalG)} g`}
                next={`${formatNumber(preview.fatG)} g`}
              />
            </div>

            {profile.useManualGoals && (
              <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">
                Los objetivos personalizados se reemplazarán por los calculados.
              </p>
            )}

            {goalError && (
              <p role="alert" className="mt-3 text-xs text-red-500">
                No se pudo actualizar el objetivo. Intentar de nuevo.
              </p>
            )}

            <div className="mt-4 flex gap-3">
              <button
                type="button"
                onClick={closeGoalChange}
                disabled={savingGoal}
                className="flex-1 rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-600 transition-colors hover:bg-gray-50 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void confirmGoalChange()}
                disabled={savingGoal}
                className="flex-1 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground transition-colors hover:opacity-90 disabled:opacity-50"
              >
                {savingGoal ? "Guardando…" : "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {editingGoals && (
        <GoalEditorSheet
          initial={{
            calorieGoal: profile.calorieGoal,
            proteinGoalG: profile.proteinGoalG,
            carbsGoalG: profile.carbsGoalG,
            fatGoalG: profile.fatGoalG,
          }}
          onSave={async (goals) => {
            await overrideGoals(goals);
            setEditingGoals(false);
          }}
          onClose={() => setEditingGoals(false)}
        />
      )}
    </div>
  );
}

function PlanRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-sm font-medium text-gray-900">{value}</span>
    </div>
  );
}

function PreviewRow({ label, current, next }: { label: string; current: string; next: string }) {
  return (
    <>
      <span className="text-gray-500">{label}</span>
      <span className="text-right text-gray-500">{current}</span>
      <span className="text-right font-medium text-gray-900">{next}</span>
    </>
  );
}
