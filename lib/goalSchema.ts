import { z } from "zod";

/**
 * Validation for the manual goal editor (GoalEditorSheet), shared by both
 * entry points (Day-screen pencil, Plan-screen "Configurar plan
 * personalizado"). Mirrors the `lib/profileSchema.ts` convention
 * (z.coerce.number, Spanish error messages, sane bounds).
 *
 * Intentionally has NO cross-field validation between macros and calories
 * (no protein*4 + carbs*4 + fat*9 == calorieGoal check) — users are allowed
 * to set macros freely relative to their calorie goal.
 */
export const goalEditorSchema = z.object({
  calorieGoal: z.coerce
    .number({ invalid_type_error: "Ingresá las calorías" })
    .min(0, "No puede ser negativo")
    .max(10000, "Máximo 10000 kcal"),
  proteinGoalG: z.coerce
    .number({ invalid_type_error: "Ingresá las proteínas" })
    .min(0, "No puede ser negativo")
    .max(1000, "Máximo 1000 g"),
  carbsGoalG: z.coerce
    .number({ invalid_type_error: "Ingresá los carbohidratos" })
    .min(0, "No puede ser negativo")
    .max(1000, "Máximo 1000 g"),
  fatGoalG: z.coerce
    .number({ invalid_type_error: "Ingresá las grasas" })
    .min(0, "No puede ser negativo")
    .max(1000, "Máximo 1000 g"),
});

export type GoalEditorValues = z.infer<typeof goalEditorSchema>;
