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
 * Optional numeric field that treats an empty string (from a cleared number
 * input) as "not provided" instead of coercing it to 0 — otherwise a cleared
 * field would silently satisfy the at-least-one-field refinement below.
 * Built from z.coerce.number() (same base as lib/goalSchema.ts) with a
 * concrete `number | string | undefined` input type so react-hook-form's
 * useForm<ProgressFormValues> can infer a usable input shape.
 */
const optionalCoercedNumber = z
  .union([z.literal(""), z.coerce.number().min(0, "No puede ser negativo")])
  .optional()
  .transform((value) => (value === "" || value === undefined ? undefined : value));

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

/** Parsed/output shape — what onSubmit receives after zodResolver runs. */
export type ProgressFormValues = z.infer<typeof progressEntrySchema>;
/** Raw shape react-hook-form's useForm<> should be parameterized with (pre-parse). */
export type ProgressFormInput = z.input<typeof progressEntrySchema>;
