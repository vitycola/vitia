import { insert } from "@/db/repositories/foods";
import { generateId } from "@/lib/id";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useNavigate, useSearchParams } from "react-router-dom";
import { z } from "zod";

const schema = z.object({
  foodName: z.string().min(1, "Ingresá el nombre del alimento").max(200),
  caloriesPer100g: z.coerce
    .number({ invalid_type_error: "Ingresá las calorías" })
    .min(0, "Debe ser 0 o mayor")
    .max(9000),
  proteinGPer100g: z.coerce.number({ invalid_type_error: "Ingresá las proteínas" }).min(0).max(100),
  carbsGPer100g: z.coerce
    .number({ invalid_type_error: "Ingresá los carbohidratos" })
    .min(0)
    .max(100),
  fatGPer100g: z.coerce.number({ invalid_type_error: "Ingresá las grasas" }).min(0).max(100),
});

type FormValues = z.infer<typeof schema>;

export function CustomFoodRoute() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const meal = searchParams.get("meal") ?? "breakfast";

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      caloriesPer100g: undefined,
      proteinGPer100g: undefined,
      carbsGPer100g: undefined,
      fatGPer100g: undefined,
    },
  });

  async function onSubmit(data: FormValues) {
    const newFood = await insert({
      id: generateId(),
      name: data.foodName,
      caloriesPer100g: data.caloriesPer100g,
      proteinPer100g: data.proteinGPer100g,
      carbsPer100g: data.carbsGPer100g,
      fatPer100g: data.fatGPer100g,
      source: "custom",
    });
    void navigate(`/portion/${newFood.id}?meal=${meal}`, { replace: true });
  }

  function handleCancel() {
    void navigate(`/search?meal=${meal}`);
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-md px-4 py-6">
        {/* Header */}
        <div className="mb-6 flex items-center gap-3">
          <button
            type="button"
            onClick={handleCancel}
            className="text-sm font-medium text-gray-500 hover:text-gray-700"
          >
            ← Cancelar
          </button>
        </div>

        <h1 className="mb-2 text-xl font-bold text-gray-900">Alimento personalizado</h1>
        <p className="mb-6 text-sm text-gray-500">
          Ingresá los datos nutricionales por cada 100 g.
        </p>

        <form onSubmit={(e) => void handleSubmit(onSubmit)(e)} className="space-y-4" noValidate>
          {/* Name */}
          <div>
            <label htmlFor="foodName" className="mb-1 block text-sm font-medium text-gray-700">
              Nombre del alimento
            </label>
            <input
              id="foodName"
              type="text"
              placeholder="Ej: Arroz integral cocido"
              {...register("foodName")}
              className={fieldClass(!!errors.foodName)}
            />
            {errors.foodName && (
              <p className="mt-1 text-xs text-red-600">{errors.foodName.message}</p>
            )}
          </div>

          {/* Calories */}
          <div>
            <label
              htmlFor="caloriesPer100g"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              Calorías (kcal / 100 g)
            </label>
            <input
              id="caloriesPer100g"
              type="number"
              inputMode="decimal"
              placeholder="0"
              {...register("caloriesPer100g")}
              className={fieldClass(!!errors.caloriesPer100g)}
            />
            {errors.caloriesPer100g && (
              <p className="mt-1 text-xs text-red-600">{errors.caloriesPer100g.message}</p>
            )}
          </div>

          {/* Protein */}
          <div>
            <label
              htmlFor="proteinGPer100g"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              Proteínas (g / 100 g)
            </label>
            <input
              id="proteinGPer100g"
              type="number"
              inputMode="decimal"
              placeholder="0"
              {...register("proteinGPer100g")}
              className={fieldClass(!!errors.proteinGPer100g)}
            />
            {errors.proteinGPer100g && (
              <p className="mt-1 text-xs text-red-600">{errors.proteinGPer100g.message}</p>
            )}
          </div>

          {/* Carbs */}
          <div>
            <label htmlFor="carbsGPer100g" className="mb-1 block text-sm font-medium text-gray-700">
              Carbohidratos (g / 100 g)
            </label>
            <input
              id="carbsGPer100g"
              type="number"
              inputMode="decimal"
              placeholder="0"
              {...register("carbsGPer100g")}
              className={fieldClass(!!errors.carbsGPer100g)}
            />
            {errors.carbsGPer100g && (
              <p className="mt-1 text-xs text-red-600">{errors.carbsGPer100g.message}</p>
            )}
          </div>

          {/* Fat */}
          <div>
            <label htmlFor="fatGPer100g" className="mb-1 block text-sm font-medium text-gray-700">
              Grasas (g / 100 g)
            </label>
            <input
              id="fatGPer100g"
              type="number"
              inputMode="decimal"
              placeholder="0"
              {...register("fatGPer100g")}
              className={fieldClass(!!errors.fatGPer100g)}
            />
            {errors.fatGPer100g && (
              <p className="mt-1 text-xs text-red-600">{errors.fatGPer100g.message}</p>
            )}
          </div>

          <div className="space-y-3 pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex w-full items-center justify-center rounded-xl bg-green-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-green-700 disabled:opacity-50"
            >
              {isSubmitting ? "Guardando…" : "Guardar y porcionar"}
            </button>

            <button
              type="button"
              onClick={handleCancel}
              className="flex w-full items-center justify-center rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm font-semibold text-gray-600 transition-colors hover:bg-gray-50"
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function fieldClass(hasError: boolean) {
  return `w-full rounded-xl border px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none transition-colors focus:border-green-500 focus:ring-2 focus:ring-green-500/20 bg-white ${
    hasError ? "border-red-400 focus:border-red-500 focus:ring-red-500/20" : "border-gray-300"
  }`;
}
