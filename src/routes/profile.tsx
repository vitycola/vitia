import { useProfileStore } from "@/stores/useProfileStore";
import { isSyncEnabled } from "@/src/lib/supabase";
import { useAuthStore } from "@/src/stores/useAuthStore";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

const ACTIVITY_LABELS: Record<string, string> = {
  sedentary: "Sedentario",
  lightly_active: "Ligeramente activo",
  moderately_active: "Moderadamente activo",
  very_active: "Muy activo",
  extra_active: "Extra activo",
};

const GOAL_LABELS: Record<string, string> = {
  lose_weight: "Perder peso",
  maintain: "Mantener peso",
  gain_muscle: "Ganar músculo",
};

const SEX_LABELS: Record<string, string> = {
  male: "Masculino",
  female: "Femenino",
};

export function ProfileRoute() {
  const navigate = useNavigate();
  const { profile, hasProfile, load, recalcFromProfile } = useProfileStore();
  const { signOut } = useAuthStore();
  const loadAttempted = useRef(false);
  const [recalcing, setRecalcing] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await signOut();
      void navigate("/login", { replace: true });
    } finally {
      setSigningOut(false);
    }
  }

  useEffect(() => {
    if (!loadAttempted.current) {
      loadAttempted.current = true;
      void load();
    }
  }, [load]);

  useEffect(() => {
    if (loadAttempted.current && !hasProfile) {
      void navigate("/onboarding", { replace: true });
    }
  }, [hasProfile, navigate]);

  async function handleRecalc() {
    setRecalcing(true);
    try {
      await recalcFromProfile();
    } finally {
      setRecalcing(false);
    }
  }

  if (!profile) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-gray-400">Cargando perfil…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-white px-4 pb-4 pt-5 shadow-sm">
        <h1 className="text-xl font-bold text-gray-900">Perfil</h1>
      </div>

      <div className="px-4 pt-4 space-y-3">
        {/* Personal data */}
        <section className="rounded-2xl bg-white px-4 py-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
            Datos personales
          </h2>
          <div className="space-y-2">
            <ProfileRow label="Edad" value={`${profile.age} años`} />
            <ProfileRow label="Altura" value={`${profile.heightCm} cm`} />
            <ProfileRow label="Peso" value={`${profile.weightKg} kg`} />
            <ProfileRow label="Sexo" value={SEX_LABELS[profile.sex] ?? profile.sex} />
            <ProfileRow
              label="Actividad"
              value={ACTIVITY_LABELS[profile.activityLevel] ?? profile.activityLevel}
            />
            <ProfileRow label="Objetivo" value={GOAL_LABELS[profile.goal] ?? profile.goal} />
          </div>
        </section>

        {/* Goals */}
        <section className="rounded-2xl bg-white px-4 py-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
            Objetivos diarios
          </h2>
          <div className="space-y-2">
            <ProfileRow
              label="Objetivo calórico"
              value={`${Math.round(profile.calorieGoal)} kcal`}
            />
            <ProfileRow label="Proteínas" value={`${Math.round(profile.proteinGoalG)} g`} />
            <ProfileRow label="Carbohidratos" value={`${Math.round(profile.carbsGoalG)} g`} />
            <ProfileRow label="Grasas" value={`${Math.round(profile.fatGoalG)} g`} />
          </div>

          {!profile.useManualGoals && (
            <button
              type="button"
              onClick={() => void handleRecalc()}
              disabled={recalcing}
              className="mt-4 flex w-full items-center justify-center rounded-xl border border-green-600 bg-white px-4 py-2.5 text-sm font-semibold text-green-600 transition-colors hover:bg-green-50 disabled:opacity-50"
            >
              {recalcing ? "Recalculando…" : "Recalcular objetivos"}
            </button>
          )}
        </section>

        {/* Edit profile */}
        <button
          type="button"
          onClick={() => void navigate("/onboarding")}
          className="flex w-full items-center justify-center rounded-xl bg-green-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-green-700"
        >
          Editar perfil
        </button>

        {/* Sign out — only shown when cloud sync is enabled */}
        {isSyncEnabled() && (
          <button
            type="button"
            onClick={() => void handleSignOut()}
            disabled={signingOut}
            className="flex w-full items-center justify-center rounded-xl border border-red-300 bg-white px-4 py-3 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
          >
            {signingOut ? "Signing out…" : "Sign out"}
          </button>
        )}
      </div>
    </div>
  );
}

function ProfileRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-sm font-medium text-gray-900">{value}</span>
    </div>
  );
}
