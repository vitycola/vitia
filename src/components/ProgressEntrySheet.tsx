import type { ProgressPhotoInput } from "@/db/repos/progress";
import {
  type ProgressFormInput,
  type ProgressFormValues,
  progressEntrySchema,
} from "@/lib/progressSchema";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { type UseFormRegisterReturn, useForm } from "react-hook-form";

export interface ProgressEntryInitial {
  weightKg?: number | null;
  neckCm?: number | null;
  waistCm?: number | null;
  hipCm?: number | null;
  notes?: string | null;
}

export interface ProgressExistingPhoto {
  id: string;
  url: string;
}

export interface ProgressSavePayload {
  weightKg?: number;
  neckCm?: number;
  waistCm?: number;
  hipCm?: number;
  notes?: string;
  photos: ProgressPhotoInput[];
}

interface ProgressEntrySheetProps {
  /** Seed values shown when the sheet opens in edit mode. */
  initial?: ProgressEntryInitial;
  /** Photos already stored for this entry — shown as thumbnails in edit mode. */
  existingPhotos?: ProgressExistingPhoto[];
  /** Only changes the header label and whether initial values seed the form. */
  mode: "create" | "edit";
  /** Called with the validated payload (measurements + new photos as Blobs). */
  onSave: (input: ProgressSavePayload) => Promise<void> | void;
  /** Dismiss without saving. */
  onClose: () => void;
}

/**
 * Reusable bottom-sheet for creating/editing a day's progress record (weight,
 * measurements, photos). Presentational and stateless w.r.t. visibility — the
 * parent conditionally renders it, mirroring the `GoalEditorSheet` pattern.
 * Both entry points (Day screen, Profile > Progreso) render the same
 * component; `mode` only changes the header label and whether `initial` /
 * `existingPhotos` seed the form (design: "ProgressEntrySheet component design").
 */
export function ProgressEntrySheet({
  initial,
  existingPhotos = [],
  mode,
  onSave,
  onClose,
}: ProgressEntrySheetProps) {
  const [files, setFiles] = useState<File[]>([]);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<ProgressFormInput, unknown, ProgressFormValues>({
    resolver: zodResolver(progressEntrySchema),
    mode: "onSubmit",
    defaultValues: {
      weightKg: initial?.weightKg ?? undefined,
      neckCm: initial?.neckCm ?? undefined,
      waistCm: initial?.waistCm ?? undefined,
      hipCm: initial?.hipCm ?? undefined,
      notes: initial?.notes ?? undefined,
      photos: existingPhotos,
    },
  });

  async function onSubmit(data: ProgressFormValues) {
    const photos: ProgressPhotoInput[] = files.map((file) => ({
      blob: file,
      mimeType: file.type,
    }));

    await onSave({
      weightKg: data.weightKg,
      neckCm: data.neckCm,
      waistCm: data.waistCm,
      hipCm: data.hipCm,
      notes: data.notes,
      photos,
    });
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files ?? []);
    setFiles(selected);
    // Keep the form's `photos` field in sync so the at-least-one-field
    // refinement in progressEntrySchema sees newly selected files.
    setValue("photos", [...existingPhotos, ...selected], { shouldValidate: false });
  }

  const title = mode === "create" ? "Añadir progreso" : "Editar progreso";

  return (
    // biome-ignore lint/a11y/useSemanticElements: custom bottom-sheet modal, not a native <dialog>
    <div
      role="dialog"
      aria-label={title}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center"
    >
      <div className="w-full max-w-sm rounded-t-2xl bg-white p-4 sm:rounded-2xl">
        <h2 className="mb-3 text-sm font-semibold text-gray-900">{title}</h2>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3">
          <ProgressField
            id="weightKg"
            label="Peso (kg)"
            register={register("weightKg")}
            error={errors.weightKg?.message}
          />

          <details className="rounded-xl border border-gray-200 p-2">
            <summary className="cursor-pointer text-sm font-medium text-gray-700">
              Medidas corporales
            </summary>
            <div className="mt-2 flex flex-col gap-3">
              <ProgressField
                id="neckCm"
                label="Cuello (cm)"
                register={register("neckCm")}
                error={errors.neckCm?.message}
              />
              <ProgressField
                id="waistCm"
                label="Cintura (cm)"
                register={register("waistCm")}
                error={errors.waistCm?.message}
              />
              <ProgressField
                id="hipCm"
                label="Cadera (cm)"
                register={register("hipCm")}
                error={errors.hipCm?.message}
              />
            </div>
          </details>

          <label htmlFor="photos" className="flex flex-col gap-1">
            <span className="text-sm text-gray-800">Fotos de progreso</span>
            <input
              id="photos"
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileChange}
              className="text-sm text-gray-600"
            />
          </label>

          <div className="mt-2 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-600 transition-colors hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex-1 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground transition-colors hover:opacity-90"
            >
              Guardar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ProgressField({
  id,
  label,
  register,
  error,
}: {
  id: string;
  label: string;
  register: UseFormRegisterReturn;
  error?: string;
}) {
  return (
    <label htmlFor={id} className="flex flex-col gap-1">
      <span className="text-sm text-gray-800">{label}</span>
      <input
        id={id}
        type="number"
        inputMode="decimal"
        className="rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900"
        {...register}
      />
      {error && <span className="text-xs text-red-500">{error}</span>}
    </label>
  );
}
