import { createComposite } from "@/db/repos/foods";
import { FOOD_CATEGORIES } from "@/lib/foodCategories";
import { generateId } from "@/lib/id";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { z } from "zod";

const categoryKeys = Object.keys(FOOD_CATEGORIES) as [string, ...string[]];

const schema = z.object({
  name: z.string().min(1, "Introduce el nombre del alimento").max(200),
  category: z.enum(categoryKeys, {
    errorMap: () => ({ message: "Selecciona una categoría" }),
  }),
  servingSizeG: z.coerce
    .number({ invalid_type_error: "Introduce el peso de la porción" })
    .gt(0, "El peso de la porción debe ser mayor que 0"),
  caloriesPer100g: z.coerce
    .number({ invalid_type_error: "Introduce las calorías" })
    .min(0, "Debe ser 0 o mayor"),
  proteinPer100g: z.coerce
    .number({ invalid_type_error: "Introduce las proteínas" })
    .min(0, "Debe ser 0 o mayor"),
  carbsPer100g: z.coerce
    .number({ invalid_type_error: "Introduce los carbohidratos" })
    .min(0, "Debe ser 0 o mayor"),
  fatPer100g: z.coerce
    .number({ invalid_type_error: "Introduce las grasas" })
    .min(0, "Debe ser 0 o mayor"),
});

type FormValues = z.infer<typeof schema>;

export function ManualFormRoute() {
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      category: undefined,
      servingSizeG: undefined,
      caloriesPer100g: undefined,
      proteinPer100g: undefined,
      carbsPer100g: undefined,
      fatPer100g: undefined,
    },
  });

  const selectedCategory = watch("category");

  async function onSubmit(data: FormValues) {
    const food = await createComposite(
      {
        id: generateId(),
        name: data.name,
        category: data.category,
        servingSizeG: data.servingSizeG,
        caloriesPer100g: data.caloriesPer100g,
        proteinPer100g: data.proteinPer100g,
        carbsPer100g: data.carbsPer100g,
        fatPer100g: data.fatPer100g,
        source: "custom",
      },
      []
    );
    void navigate(`/search?created=${food.id}`);
  }

  function handleCancel() {
    void navigate(-1 as unknown as string);
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-md px-4 py-6">
        <div className="mb-6 flex items-center gap-3">
          <button
            type="button"
            onClick={handleCancel}
            className="text-sm font-medium text-gray-500 hover:text-gray-700"
          >
            ← Cancelar
          </button>
        </div>

        <h1 className="mb-2 text-xl font-bold text-gray-900">Crear alimento manual</h1>
        <p className="mb-6 text-sm text-gray-500">
          Introduce el nombre, la categoría y los valores nutricionales.
        </p>

        <form onSubmit={(e) => void handleSubmit(onSubmit)(e)} className="space-y-4" noValidate>
          {/* Name */}
          <div>
            <label htmlFor="name" className="mb-1 block text-sm font-medium text-gray-700">
              Nombre del alimento
            </label>
            <input
              id="name"
              type="text"
              placeholder="Ej: Tortilla casera"
              {...register("name")}
              className={fieldClass(!!errors.name)}
            />
            {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name.message}</p>}
          </div>

          {/* Category chips */}
          <div>
            <span className="mb-1 block text-sm font-medium text-gray-700">Categoría</span>
            <div className="flex flex-wrap gap-2">
              {Object.entries(FOOD_CATEGORIES).map(([key, { label, icon }]) => {
                const isSelected = selectedCategory === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setValue("category", key, { shouldValidate: true })}
                    className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                      isSelected
                        ? "border-accent bg-accent text-accent-foreground"
                        : "border-gray-300 bg-white text-gray-700 hover:border-accent"
                    }`}
                  >
                    <span>{icon}</span>
                    <span>{label}</span>
                  </button>
                );
              })}
            </div>
            {errors.category && (
              <p className="mt-1 text-xs text-red-600">{errors.category.message}</p>
            )}
          </div>

          {/* Portion weight */}
          <div>
            <label htmlFor="servingSizeG" className="mb-1 block text-sm font-medium text-gray-700">
              Peso de la porción (g)
            </label>
            <input
              id="servingSizeG"
              type="number"
              inputMode="decimal"
              placeholder="0"
              {...register("servingSizeG")}
              className={fieldClass(!!errors.servingSizeG)}
            />
            {errors.servingSizeG && (
              <p className="mt-1 text-xs text-red-600">{errors.servingSizeG.message}</p>
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
              htmlFor="proteinPer100g"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              Proteínas (g / 100 g)
            </label>
            <input
              id="proteinPer100g"
              type="number"
              inputMode="decimal"
              placeholder="0"
              {...register("proteinPer100g")}
              className={fieldClass(!!errors.proteinPer100g)}
            />
            {errors.proteinPer100g && (
              <p className="mt-1 text-xs text-red-600">{errors.proteinPer100g.message}</p>
            )}
          </div>

          {/* Carbs */}
          <div>
            <label htmlFor="carbsPer100g" className="mb-1 block text-sm font-medium text-gray-700">
              Carbohidratos (g / 100 g)
            </label>
            <input
              id="carbsPer100g"
              type="number"
              inputMode="decimal"
              placeholder="0"
              {...register("carbsPer100g")}
              className={fieldClass(!!errors.carbsPer100g)}
            />
            {errors.carbsPer100g && (
              <p className="mt-1 text-xs text-red-600">{errors.carbsPer100g.message}</p>
            )}
          </div>

          {/* Fat */}
          <div>
            <label htmlFor="fatPer100g" className="mb-1 block text-sm font-medium text-gray-700">
              Grasas (g / 100 g)
            </label>
            <input
              id="fatPer100g"
              type="number"
              inputMode="decimal"
              placeholder="0"
              {...register("fatPer100g")}
              className={fieldClass(!!errors.fatPer100g)}
            />
            {errors.fatPer100g && (
              <p className="mt-1 text-xs text-red-600">{errors.fatPer100g.message}</p>
            )}
          </div>

          <div className="space-y-3 pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex w-full items-center justify-center rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-accent-foreground transition-colors hover:opacity-90 disabled:opacity-50"
            >
              {isSubmitting ? "Guardando…" : "Guardar"}
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
  return `w-full rounded-xl border px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/20 bg-white ${
    hasError ? "border-red-400 focus:border-red-500 focus:ring-red-500/20" : "border-gray-300"
  }`;
}
