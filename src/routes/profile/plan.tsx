import { GoalEditorSheet } from "@/src/components/GoalEditorSheet";
import { useProfileStore } from "@/stores/useProfileStore";
import { useState } from "react";

const GOAL_LABELS: Record<string, string> = {
  lose_weight: "Perder peso",
  maintain: "Mantener peso",
  gain_muscle: "Ganar músculo",
};

const GOAL_PRESETS = ["lose_weight", "maintain", "gain_muscle"] as const;

/**
 * Presentational-ish Plan view: current goal, the 3 available presets, the
 * daily macro targets, and the entry point for manually overriding goals via
 * the shared `GoalEditorSheet` (same component used by the Day-screen
 * pencil, seeded from the same profile values so both stay in sync).
 */
export function PlanRoute() {
  const { profile, recalcFromProfile, overrideGoals, revertToAutomaticGoals } = useProfileStore();
  const [recalcing, setRecalcing] = useState(false);
  const [reverting, setReverting] = useState(false);
  const [editingGoals, setEditingGoals] = useState(false);

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

  return (
    <div className="space-y-3">
      <section className="rounded-2xl bg-white px-4 py-4 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Objetivo actual
        </h2>
        <p className="text-sm font-medium text-gray-900">{GOAL_LABELS[profile.goal]}</p>

        <div className="mt-3 flex gap-2">
          {GOAL_PRESETS.map((goal) => (
            <span
              key={goal}
              className={[
                "flex-1 rounded-xl border px-2 py-2 text-center text-xs font-medium",
                goal === profile.goal
                  ? "border-accent text-accent"
                  : "border-gray-200 text-gray-400",
              ].join(" ")}
            >
              {GOAL_LABELS[goal]}
            </span>
          ))}
        </div>
      </section>

      <section className="rounded-2xl bg-white px-4 py-4 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Objetivos diarios
        </h2>
        <div className="space-y-2">
          <PlanRow label="Objetivo calórico" value={`${Math.round(profile.calorieGoal)} kcal`} />
          <PlanRow label="Proteínas" value={`${Math.round(profile.proteinGoalG)} g`} />
          <PlanRow label="Carbohidratos" value={`${Math.round(profile.carbsGoalG)} g`} />
          <PlanRow label="Grasas" value={`${Math.round(profile.fatGoalG)} g`} />
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
