import { getById, getByIds, getIngredients, upsertIngredients } from "@/db/repos/foods";
import { sumIngredientMacros } from "@/lib/nutrition";
import { useRecipeBuilderStore } from "@/stores/useRecipeBuilderStore";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

interface DanglingIngredient {
  ingredientFoodId: string;
  weightG: number;
}

/**
 * Reopen and edit an existing composite food's recipe.
 * Spec: Dangling Ingredient Handling — a food_ingredients row whose referenced
 * food was deleted must render "Ingrediente no disponible" instead of
 * crashing, and viewing must not recompute the parent's snapshot. Dangling
 * rows are kept out of useRecipeBuilderStore (which requires a real Food) so
 * they're naturally excluded from what gets persisted on explicit save.
 */
export function RecipeDetailRoute() {
  const { foodId } = useParams<{ foodId: string }>();
  const navigate = useNavigate();
  const { ingredients, updateWeight, removeIngredient, clear, addIngredient } =
    useRecipeBuilderStore();

  const [foodName, setFoodName] = useState<string | null>(null);
  const [danglingRows, setDanglingRows] = useState<DanglingIngredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // biome-ignore lint/correctness/useExhaustiveDependencies: addIngredient/clear are store actions, stable by identity
  useEffect(() => {
    if (!foodId) return;
    let cancelled = false;
    clear();

    (async () => {
      const [food, rows] = await Promise.all([getById(foodId), getIngredients(foodId)]);
      const ingredientFoods = await getByIds(rows.map((r) => r.ingredientFoodId));
      const byId = new Map(ingredientFoods.map((f) => [f.id, f]));
      if (cancelled) return;

      setFoodName(food?.name ?? null);

      const dangling: DanglingIngredient[] = [];
      for (const row of rows) {
        const ingredientFood = byId.get(row.ingredientFoodId);
        if (ingredientFood) {
          addIngredient(ingredientFood, row.weightG);
        } else {
          dangling.push({ ingredientFoodId: row.ingredientFoodId, weightG: row.weightG });
        }
      }
      setDanglingRows(dangling);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [foodId]);

  const preview =
    ingredients.length > 0
      ? sumIngredientMacros(ingredients.map((i) => ({ food: i.food, weightG: i.weightG })))
      : null;

  function handleCancel() {
    clear();
    void navigate(-1 as unknown as string);
  }

  function handleAddIngredient() {
    void navigate("/create-food/ingredients/add");
  }

  async function handleSave() {
    if (!foodId) return;
    setError(null);

    if (ingredients.length === 0) {
      setError("La receta debe tener al menos un ingrediente.");
      return;
    }

    setIsSubmitting(true);
    try {
      const ingredientInputs = ingredients.map((i, index) => ({
        ingredientFoodId: i.food.id,
        weightG: i.weightG,
        position: index,
      }));
      await upsertIngredients(foodId, ingredientInputs);
      clear();
      void navigate(`/search?created=${foodId}`);
    } finally {
      setIsSubmitting(false);
    }
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

        {loading ? (
          <p className="py-4 text-center text-sm text-gray-400">Cargando…</p>
        ) : (
          <>
            <h1 className="mb-6 text-xl font-bold text-gray-900">{foodName ?? "Receta"}</h1>

            <div className="mb-4">
              <span className="mb-2 block text-sm font-medium text-gray-700">Ingredientes</span>

              <div className="flex flex-col gap-2">
                {ingredients.map((ingredient) => (
                  <div
                    key={ingredient.food.id}
                    className="flex items-center gap-3 rounded-xl bg-white px-3 py-2.5 shadow-sm"
                  >
                    <span className="flex-1 truncate text-sm font-medium text-gray-900">
                      {ingredient.food.name}
                    </span>
                    <label className="sr-only" htmlFor={`weight-${ingredient.food.id}`}>
                      Peso de {ingredient.food.name} (g)
                    </label>
                    <input
                      id={`weight-${ingredient.food.id}`}
                      type="number"
                      inputMode="decimal"
                      value={ingredient.weightG}
                      onChange={(e) => updateWeight(ingredient.food.id, Number(e.target.value))}
                      className="w-20 rounded-lg border border-gray-300 px-2 py-1.5 text-right text-sm text-gray-900 outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
                    />
                    <span className="text-xs text-gray-400">g</span>
                    <button
                      type="button"
                      aria-label={`Eliminar ${ingredient.food.name}`}
                      onClick={() => removeIngredient(ingredient.food.id)}
                      className="text-sm font-medium text-red-500 hover:text-red-700"
                    >
                      ✕
                    </button>
                  </div>
                ))}

                {danglingRows.map((row) => (
                  <div
                    key={row.ingredientFoodId}
                    className="flex items-center gap-3 rounded-xl bg-white px-3 py-2.5 shadow-sm"
                  >
                    <span className="flex-1 truncate text-sm italic text-gray-400">
                      Ingrediente no disponible
                    </span>
                    <span className="text-xs text-gray-400">{Math.round(row.weightG)} g</span>
                    <button
                      type="button"
                      aria-label="Quitar ingrediente no disponible"
                      onClick={() =>
                        setDanglingRows((prev) =>
                          prev.filter((d) => d.ingredientFoodId !== row.ingredientFoodId)
                        )
                      }
                      className="text-sm font-medium text-red-500 hover:text-red-700"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={handleAddIngredient}
                className="mt-3 flex w-full items-center justify-center rounded-xl border border-dashed border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-600 transition-colors hover:border-accent hover:text-accent"
              >
                + Añadir ingrediente
              </button>
            </div>

            {preview && (
              <div className="mb-4 rounded-xl bg-white px-4 py-3 shadow-sm">
                <p className="mb-1 text-sm font-semibold text-gray-900">
                  {Math.round(preview.totalCalories)} kcal total ({Math.round(preview.totalWeightG)}
                  g)
                </p>
                <p className="text-xs text-gray-400">
                  P {Math.round(preview.totalProteinG)}g · C {Math.round(preview.totalCarbsG)}g · G{" "}
                  {Math.round(preview.totalFatG)}g — {Math.round(preview.caloriesPer100g)} kcal/100g
                </p>
              </div>
            )}

            {error && <p className="mb-4 text-xs text-red-600">{error}</p>}

            <div className="space-y-3 pt-2">
              <button
                type="button"
                onClick={() => void handleSave()}
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
          </>
        )}
      </div>
    </div>
  );
}
