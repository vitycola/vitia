import { computeBMR, computeTDEE, deriveCalorieGoal, deriveMacros } from "@/lib/nutrition";
import { profileFieldsSchema } from "@/lib/profileSchema";
import { getSupabaseClient, isSyncEnabled } from "@/src/lib/supabase";
import { useAuthStore } from "@/src/stores/useAuthStore";
import { useProfileStore } from "@/stores/useProfileStore";
import type { ActivityLevel, Goal, Sex } from "@/types";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { z } from "zod";

// Onboarding extends the shared profile fields with the goal selection,
// which only exists on first-run (Configuración edits the goal separately
// via the Plan tab).
const schema = profileFieldsSchema.extend({
  goal: z.enum(["lose_weight", "maintain", "gain_muscle"], {
    required_error: "Seleccioná el objetivo",
  }),
});

type FormValues = z.infer<typeof schema>;

function computePreview(values: Partial<FormValues>) {
  const { age, heightCm, weightKg, sex, activityLevel, goal } = values;
  if (!age || !heightCm || !weightKg || !sex || !activityLevel || !goal) return null;
  const bmr = computeBMR({ age, heightCm, weightKg, sex });
  const tdee = computeTDEE(bmr, activityLevel);
  const calorieGoal = deriveCalorieGoal(tdee, goal);
  const macros = deriveMacros(calorieGoal);
  return { calorieGoal, ...macros };
}

export function OnboardingRoute() {
  const navigate = useNavigate();
  const { saveProfile } = useProfileStore();
  const { userId } = useAuthStore();

  // On mount, check if the user already has a cloud profile.
  // If yes, skip onboarding and go to the main app.
  useEffect(() => {
    if (!isSyncEnabled() || !userId) return;

    const checkCloudProfile = async () => {
      try {
        const supabase = getSupabaseClient();
        const { data } = await supabase
          .from("users_profile")
          .select("user_id")
          .eq("user_id", userId)
          .single();

        if (data) {
          // Profile exists in the cloud — pull it and skip onboarding
          const { sync } = await import("@/src/services/syncService");
          await sync(userId);
          void navigate("/", { replace: true });
        }
      } catch {
        // No cloud profile found — continue with onboarding
      }
    };

    void checkCloudProfile();
  }, [userId, navigate]);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: "onChange",
  });

  const values = watch();
  const preview = computePreview(values);

  async function onSubmit(data: FormValues) {
    console.log("[onboarding] onSubmit called", data);
    try {
      await saveProfile({
        age: data.age,
        heightCm: data.heightCm,
        weightKg: data.weightKg,
        sex: data.sex as Sex,
        activityLevel: data.activityLevel as ActivityLevel,
        goal: data.goal as Goal,
      });
      console.log("[onboarding] saveProfile OK — navigating to /");
    } catch (err) {
      console.error("[onboarding] saveProfile FAILED", err);
      throw err;
    }
    void navigate("/", { replace: true });
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-md px-4 py-8">
        <h1 className="mb-2 text-2xl font-bold text-gray-900">Tu perfil</h1>
        <p className="mb-6 text-sm text-gray-500">
          Completá tus datos para calcular tus objetivos calóricos.
        </p>

        {/* Live TDEE preview */}
        {preview && (
          <div className="mb-6 rounded-2xl bg-surface px-4 py-4">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-[#8E8E93]">
              Objetivo estimado
            </p>
            <p className="text-2xl font-bold text-[#1C1C1E]">{preview.calorieGoal} kcal</p>
            <p className="mt-1 text-xs text-[#8E8E93]">
              P {preview.proteinG}g · C {preview.carbsG}g · G {preview.fatG}g
            </p>
          </div>
        )}

        <form onSubmit={(e) => void handleSubmit(onSubmit)(e)} className="space-y-4" noValidate>
          {/* Age */}
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

          {/* Height */}
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

          {/* Weight */}
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

          {/* Sex */}
          <div>
            <label htmlFor="sex" className="mb-1 block text-sm font-medium text-gray-700">
              Sexo
            </label>
            <select id="sex" {...register("sex")} className={fieldClass(!!errors.sex)}>
              <option value="">Seleccioná...</option>
              <option value="male">Masculino</option>
              <option value="female">Femenino</option>
            </select>
            {errors.sex && <p className="mt-1 text-xs text-red-600">{errors.sex.message}</p>}
          </div>

          {/* Activity level */}
          <div>
            <label htmlFor="activityLevel" className="mb-1 block text-sm font-medium text-gray-700">
              Nivel de actividad
            </label>
            <select
              id="activityLevel"
              {...register("activityLevel")}
              className={fieldClass(!!errors.activityLevel)}
            >
              <option value="">Seleccioná...</option>
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

          {/* Goal */}
          <div>
            <label htmlFor="goal" className="mb-1 block text-sm font-medium text-gray-700">
              Objetivo
            </label>
            <select id="goal" {...register("goal")} className={fieldClass(!!errors.goal)}>
              <option value="">Seleccioná...</option>
              <option value="lose_weight">Perder peso</option>
              <option value="maintain">Mantener peso</option>
              <option value="gain_muscle">Ganar músculo</option>
            </select>
            {errors.goal && <p className="mt-1 text-xs text-red-600">{errors.goal.message}</p>}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-2 flex w-full items-center justify-center rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-accent-foreground transition-colors hover:opacity-90 disabled:opacity-50"
          >
            {isSubmitting ? "Guardando…" : "Guardar perfil"}
          </button>
        </form>
      </div>
    </div>
  );
}

function fieldClass(hasError: boolean) {
  return `w-full rounded-xl border px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/20 bg-white ${
    hasError ? "border-red-400 focus:border-red-500 focus:ring-red-500/20" : "border-gray-300"
  }`;
}
