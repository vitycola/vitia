import { profileFieldsSchema } from "@/lib/profileSchema";
import { isSyncEnabled } from "@/src/lib/supabase";
import { useAuthStore } from "@/src/stores/useAuthStore";
import { useProfileStore } from "@/stores/useProfileStore";
import type { ActivityLevel, Sex } from "@/types";
import { zodResolver } from "@hookform/resolvers/zod";
import { Settings } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import type { z } from "zod";

type FormValues = z.infer<typeof profileFieldsSchema>;

const MEASUREMENT_PLACEHOLDER_LABELS = [
  "Cuello",
  "Pecho",
  "Brazo",
  "Cintura",
  "Cadera",
  "Muslo",
] as const;

const SEX_LABELS: Record<Sex, string> = {
  male: "Masculino",
  female: "Femenino",
};

const ACTIVITY_LABELS: Record<ActivityLevel, string> = {
  sedentary: "Sedentario (sin ejercicio)",
  lightly_active: "Ligeramente activo (1–3 días/semana)",
  moderately_active: "Moderadamente activo (3–5 días/semana)",
  very_active: "Muy activo (6–7 días/semana)",
  extra_active: "Extra activo (dos veces al día)",
};

/**
 * Editable personal-data form for the Configuración tab. Reuses the shared
 * `profileFieldsSchema` (same validation as onboarding) and writes through
 * `useProfileStore.saveProfile` — the offline-first Dexie + syncQueue path
 * is untouched.
 *
 * Weight forward-compat seam (SDD-1): `saveProfile` remains the SOLE
 * weight-write path. A future dated weight-log feature can wrap this same
 * call to additionally append a history entry, without requiring this form
 * to change its contract.
 */
export function ConfigurationRoute() {
  const navigate = useNavigate();
  const { profile, saveProfile } = useProfileStore();
  const { signOut } = useAuthStore();
  const [signingOut, setSigningOut] = useState(false);
  const [editing, setEditing] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(profileFieldsSchema),
    mode: "onChange",
    defaultValues: profile
      ? {
          age: profile.age,
          heightCm: profile.heightCm,
          weightKg: profile.weightKg,
          sex: profile.sex,
          activityLevel: profile.activityLevel,
        }
      : undefined,
  });

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

  function handleCancelEdit() {
    if (!profile) return;
    reset({
      age: profile.age,
      heightCm: profile.heightCm,
      weightKg: profile.weightKg,
      sex: profile.sex,
      activityLevel: profile.activityLevel,
    });
    setEditing(false);
  }

  async function onSubmit(data: FormValues) {
    if (!profile) return;
    await saveProfile({
      age: data.age,
      heightCm: data.heightCm,
      weightKg: data.weightKg,
      sex: data.sex as Sex,
      activityLevel: data.activityLevel as ActivityLevel,
      // Goal is edited from the Plan tab, not here — preserve the current value.
      goal: profile.goal,
    });
    setEditing(false);
  }

  return (
    <div className="space-y-3">
      <section className="rounded-2xl bg-white px-4 py-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
            Datos personales
          </h2>
          {!editing && (
            <button
              type="button"
              aria-label="Editar datos personales"
              onClick={() => setEditing(true)}
              className="text-gray-400 transition-colors hover:text-accent"
            >
              <Settings size={20} />
            </button>
          )}
        </div>

        {!editing ? (
          <div className="space-y-2">
            <ProfileRow label="Edad" value={`${profile.age} años`} />
            <ProfileRow label="Altura" value={`${profile.heightCm} cm`} />
            <ProfileRow label="Peso" value={`${profile.weightKg} kg`} />
            <ProfileRow label="Sexo" value={SEX_LABELS[profile.sex]} />
            <ProfileRow label="Actividad" value={ACTIVITY_LABELS[profile.activityLevel]} />
          </div>
        ) : (
          <form onSubmit={(e) => void handleSubmit(onSubmit)(e)} noValidate>
            <div className="space-y-4">
              <div>
                <label htmlFor="age" className="mb-1 block text-sm font-medium text-gray-700">
                  Edad
                </label>
                <input
                  id="age"
                  type="number"
                  inputMode="numeric"
                  placeholder="Años"
                  {...register("age")}
                  className={fieldClass(!!errors.age)}
                />
                {errors.age && <p className="mt-1 text-xs text-red-600">{errors.age.message}</p>}
              </div>

              <div>
                <label htmlFor="heightCm" className="mb-1 block text-sm font-medium text-gray-700">
                  Altura (cm)
                </label>
                <input
                  id="heightCm"
                  type="number"
                  inputMode="decimal"
                  placeholder="Centímetros"
                  {...register("heightCm")}
                  className={fieldClass(!!errors.heightCm)}
                />
                {errors.heightCm && (
                  <p className="mt-1 text-xs text-red-600">{errors.heightCm.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="weightKg" className="mb-1 block text-sm font-medium text-gray-700">
                  Peso (kg)
                </label>
                <input
                  id="weightKg"
                  type="number"
                  inputMode="decimal"
                  placeholder="Kilogramos"
                  {...register("weightKg")}
                  className={fieldClass(!!errors.weightKg)}
                />
                {errors.weightKg && (
                  <p className="mt-1 text-xs text-red-600">{errors.weightKg.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="sex" className="mb-1 block text-sm font-medium text-gray-700">
                  Sexo
                </label>
                <select id="sex" {...register("sex")} className={fieldClass(!!errors.sex)}>
                  <option value="male">Masculino</option>
                  <option value="female">Femenino</option>
                </select>
                {errors.sex && <p className="mt-1 text-xs text-red-600">{errors.sex.message}</p>}
              </div>

              <div>
                <label
                  htmlFor="activityLevel"
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  Nivel de actividad
                </label>
                <select
                  id="activityLevel"
                  {...register("activityLevel")}
                  className={fieldClass(!!errors.activityLevel)}
                >
                  <option value="sedentary">Sedentario (sin ejercicio)</option>
                  <option value="lightly_active">Ligeramente activo (1–3 días/semana)</option>
                  <option value="moderately_active">Moderadamente activo (3–5 días/semana)</option>
                  <option value="very_active">Muy activo (6–7 días/semana)</option>
                  <option value="extra_active">Extra activo (dos veces al día)</option>
                </select>
                {errors.activityLevel && (
                  <p className="mt-1 text-xs text-red-600">{errors.activityLevel.message}</p>
                )}
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={handleCancelEdit}
                className="flex flex-1 items-center justify-center rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm font-semibold text-gray-600 transition-colors hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex flex-1 items-center justify-center rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-accent-foreground transition-colors hover:opacity-90 disabled:opacity-50"
              >
                {isSubmitting ? "Guardando…" : "Guardar cambios"}
              </button>
            </div>
          </form>
        )}
      </section>

      {/* Body measurements — visual placeholders only, no persistence (SDD-1 seam) */}
      <section className="rounded-2xl bg-white px-4 py-4 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
          Medidas corporales
        </h2>
        <div className="space-y-2">
          {MEASUREMENT_PLACEHOLDER_LABELS.map((label) => (
            <div key={label} className="flex items-center justify-between py-1">
              <span className="text-sm text-gray-500">{label}</span>
              <span className="text-sm text-gray-300">Próximamente</span>
            </div>
          ))}
        </div>
      </section>

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

function fieldClass(hasError: boolean) {
  return `w-full rounded-xl border px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/20 bg-white ${
    hasError ? "border-red-400 focus:border-red-500 focus:ring-red-500/20" : "border-gray-300"
  }`;
}

function ProfileRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-sm font-medium text-gray-900">{value}</span>
    </div>
  );
}
