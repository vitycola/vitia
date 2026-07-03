import { z } from "zod";

/**
 * Shared field rules for the personal-data portion of a user profile
 * (age, height, weight, sex, activity level). Single source of truth
 * consumed by both the onboarding first-run flow and the Configuración
 * edit form, so validation never diverges between the two entry points.
 */
export const profileFieldsSchema = z.object({
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
});

export type ProfileFieldsValues = z.infer<typeof profileFieldsSchema>;
