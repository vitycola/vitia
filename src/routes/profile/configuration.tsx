import { isSyncEnabled } from "@/src/lib/supabase";
import { useAuthStore } from "@/src/stores/useAuthStore";
import { useProfileStore } from "@/stores/useProfileStore";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

const ACTIVITY_LABELS: Record<string, string> = {
  sedentary: "Sedentario",
  lightly_active: "Ligeramente activo",
  moderately_active: "Moderadamente activo",
  very_active: "Muy activo",
  extra_active: "Extra activo",
};

const SEX_LABELS: Record<string, string> = {
  male: "Masculino",
  female: "Femenino",
};

/**
 * PENDING UNIT 2: this is a read-only placeholder ported verbatim from the
 * former flat ProfileRoute's "Datos personales" section, kept navigable so
 * the /profile/plan and /profile/progress shell isn't blocked. It will be
 * replaced by an editable RHF + zod form (see design capability
 * profile-configuration) wired to `useProfileStore.saveProfile`, backed by
 * the shared schema extracted to `src/lib/profileSchema.ts`. The existing
 * onboarding "Editar perfil" edit path is intentionally left intact until
 * Unit 2 rewires it.
 */
export function ConfigurationRoute() {
  const navigate = useNavigate();
  const { profile } = useProfileStore();
  const { signOut } = useAuthStore();
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

  if (!profile) return null;

  return (
    <div className="space-y-3">
      <section className="rounded-2xl bg-white px-4 py-4 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Datos personales
        </h2>
        <div className="space-y-2">
          <ConfigRow label="Edad" value={`${profile.age} años`} />
          <ConfigRow label="Altura" value={`${profile.heightCm} cm`} />
          <ConfigRow label="Peso" value={`${profile.weightKg} kg`} />
          <ConfigRow label="Sexo" value={SEX_LABELS[profile.sex] ?? profile.sex} />
          <ConfigRow
            label="Actividad"
            value={ACTIVITY_LABELS[profile.activityLevel] ?? profile.activityLevel}
          />
        </div>
      </section>

      {/* Edit profile — pending Unit 2 rewire to an inline editable form */}
      <button
        type="button"
        onClick={() => void navigate("/onboarding")}
        className="flex w-full items-center justify-center rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-accent-foreground transition-colors hover:opacity-90"
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
  );
}

function ConfigRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-sm font-medium text-gray-900">{value}</span>
    </div>
  );
}
