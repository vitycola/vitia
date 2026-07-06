import { z } from "zod";

/**
 * Validation for the progress-entry form (ProgressEntrySheet), shared by
 * both entry points (Day-screen, Profile > Progreso). All fields are
 * optional individually — the `.refine()` below enforces the "at least one
 * of weight/measurements/photos" rule (spec: Reject empty submission).
 *
 * Mirrors the `lib/goalSchema.ts` convention (z.coerce.number, sane bounds).
 */
/**
 * Treats an empty string (from a cleared number input) as "not provided" so
 * it does not coerce to 0 and satisfy the at-least-one-field refinement below.
 */
const optionalCoercedNumber = z.preprocess(
  (value) => (value === "" || value === null ? undefined : value),
  z.coerce.number().min(0, "No puede ser negativo").optional()
);

export const progressEntrySchema = z
  .object({
    weightKg: optionalCoercedNumber,
    neckCm: optionalCoercedNumber,
    waistCm: optionalCoercedNumber,
    hipCm: optionalCoercedNumber,
    notes: z.string().optional(),
    photos: z.array(z.unknown()).optional(),
  })
  .refine(
    (data) =>
      data.weightKg !== undefined ||
      data.neckCm !== undefined ||
      data.waistCm !== undefined ||
      data.hipCm !== undefined ||
      (data.photos !== undefined && data.photos.length > 0),
    {
      message: "Ingresá al menos un dato: peso, una medida o una foto",
      path: ["weightKg"],
    }
  );

export type ProgressFormValues = z.infer<typeof progressEntrySchema>;
