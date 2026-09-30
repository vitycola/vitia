import { z } from "zod";

/**
 * Shared field rules for the personal-data portion of a user profile
 * (age, height, weight, sex, activity level). Single source of truth
 * consumed by both the onboarding first-run flow and the Configuración
 * edit form, so validation never diverges between the two entry points.
 */
const REQUIRED_FIELD_MESSAGE = "Campo obligatorio";
const REQUIRED_OPTION_MESSAGE = "Opción obligatoria";

// Empty form inputs arrive as "" and must be reported as missing rather than
// coerced to 0 (which would surface a misleading "minimum" message).
const numericField = (min: number, max: number, unit: string, integer = false) => {
  const base = z
    .number({ required_error: REQUIRED_FIELD_MESSAGE, invalid_type_error: REQUIRED_FIELD_MESSAGE })
    .min(min, `Debe estar entre ${min} y ${max} ${unit}`)
    .max(max, `Debe estar entre ${min} y ${max} ${unit}`);
  const ranged = integer ? base.int("Debe ser un número entero") : base;
  // Cast keeps the form input type as `number` (like z.coerce.number did) so
  // react-hook-form's resolver typing is unchanged.
  return z.preprocess((value) => {
    if (value === null || value === undefined) return undefined;
    if (typeof value !== "string") return Number(value);
    const trimmed = value.trim();
    if (trimmed === "") return undefined;
    // Accept a single comma as decimal separator ("80,5" -> 80.5).
    return Number(trimmed.replace(",", "."));
  }, ranged) as unknown as z.ZodType<number, z.ZodTypeDef, number>;
};

export const requiredOptionError = { errorMap: () => ({ message: REQUIRED_OPTION_MESSAGE }) };

export const profileFieldsSchema = z.object({
  age: numericField(10, 120, "años", true),
  heightCm: numericField(50, 280, "cm"),
  weightKg: numericField(10, 400, "kg"),
  sex: z.enum(["male", "female"], requiredOptionError),
  activityLevel: z.enum(
    ["sedentary", "lightly_active", "moderately_active", "very_active", "extra_active"],
    requiredOptionError
  ),
});

export type ProfileFieldsValues = z.infer<typeof profileFieldsSchema>;
