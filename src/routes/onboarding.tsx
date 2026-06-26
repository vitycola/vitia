import { computeBMR, computeTDEE, deriveCalorieGoal, deriveMacros } from "@/lib/nutrition";
import { useProfileStore } from "@/stores/useProfileStore";
import type { ActivityLevel, Goal, Sex } from "@/types";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { z } from "zod";

const schema = z.object({
  age: z.coerce
    .number({ invalid_type_error: "Ingresá tu edad" })
    .int()
    .min(10, "Mínimo 10 años")
    .max(120, "Máximo 120 años"),
  heightCm: z.coerce
    .number({ invalid_type_error: "Ingresá tu altura" })
    .min(50, "Mínimo 50 cm")
    .max(280, "Máximo 280 cm"),
  weightKg: z.coerce
    .number({ invalid_type_error: "Ingresá tu peso" })
    .min(10, "Mínimo 10 kg")
    .max(600, "Máximo 600 kg"),
  sex: z.enum(["male", "female"], { required_error: "Seleccioná el sexo" }),
  activityLevel: z.enum(
    ["sedentary", "lightly_active", "moderately_active", "very_active", "extra_active"],
    { required_error: "Seleccioná el nivel de actividad" }
  ),
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
    await saveProfile({
      age: data.age,
      heightCm: data.heightCm,
      weightKg: data.weightKg,
      sex: data.sex as Sex,
      activityLevel: data.activityLevel as ActivityLevel,
      goal: data.goal as Goal,
    });
    void navigate("/", { replace: true });
  }

  return (
    <div className="min-h-screen bg-surface">
      <div className="mx-auto max-w-md px-4 py-8">
        <h1 className="mb-2 text-2xl font-bold text-primary">Tu perfil</h1>
        <p className="mb-6 text-sm text-secondary">
          Completá tus datos para calcular tus objetivos calóricos.
        </p>

        {/* Live TDEE preview */}
        {preview && (
          <div className="mb-6 rounded-2xl bg-accent/5 px-4 py-4">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-accent">
              Objetivo estimado
            </p>
            <p className="text-2xl font-bold text-accent">{preview.calorieGoal} kcal</p>
            <p className="mt-1 text-xs text-accent">
              P {preview.proteinG}g · C {preview.carbsG}g · G {preview.fatG}g
            </p>
          </div>
        )}

        <form onSubmit={(e) => void handleSubmit(onSubmit)(e)} className="space-y-4" noValidate>
          {/* Age */}
          <div>
            <label htmlFor="age" className="mb-1 block text-sm font-medium text-primary">
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
            <label htmlFor="heightCm" className="mb-1 block text-sm font-medium text-primary">
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
            <label htmlFor="weightKg" className="mb-1 block text-sm font-medium text-primary">
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
            <label htmlFor="sex" className="mb-1 block text-sm font-medium text-primary">
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
            <label htmlFor="activityLevel" className="mb-1 block text-sm font-medium text-primary">
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
            <label htmlFor="goal" className="mb-1 block text-sm font-medium text-primary">
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
            className="mt-2 flex w-full items-center justify-center rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-accent/90 disabled:opacity-50"
          >
            {isSubmitting ? "Guardando…" : "Guardar perfil"}
          </button>
        </form>
      </div>
    </div>
  );
}

function fieldClass(hasError: boolean) {
  return `w-full rounded-xl border px-3 py-2.5 text-sm text-primary placeholder-disabled outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/20 bg-white ${
    hasError ? "border-red-400 focus:border-red-500 focus:ring-red-500/20" : "border-default"
  }`;
}
