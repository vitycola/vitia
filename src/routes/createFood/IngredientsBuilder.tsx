import { createComposite, upsertIngredients } from "@/db/repos/foods";
import { FOOD_CATEGORIES } from "@/lib/foodCategories";
import { generateId } from "@/lib/id";
import { sumIngredientMacros } from "@/lib/nutrition";
import { useRecipeBuilderStore } from "@/stores/useRecipeBuilderStore";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

export function IngredientsBuilderRoute() {
  const navigate = useNavigate();
  const {
    ingredients,
    updateWeight,
    removeIngredient,
    clear,
    name,
    category,
    setName,
    setCategory,
  } = useRecipeBuilderStore();

  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
    setError(null);

    if (!name.trim()) {
      setError("Introduce el nombre del alimento.");
      return;
    }
    if (!category) {
      setError("Selecciona una categoría.");
      return;
    }
    if (ingredients.length === 0) {
      setError("La receta debe tener al menos un ingrediente.");
      return;
    }

    setIsSubmitting(true);
    try {
      const summed = sumIngredientMacros(
        ingredients.map((i) => ({ food: i.food, weightG: i.weightG }))
      );
      const ingredientInputs = ingredients.map((i, index) => ({
        ingredientFoodId: i.food.id,
        weightG: i.weightG,
        position: index,
      }));

      const food = await createComposite(
        {
          id: generateId(),
          name,
          category,
          servingSizeG: summed.totalWeightG,
          caloriesPer100g: summed.caloriesPer100g,
          proteinPer100g: summed.proteinPer100g,
          carbsPer100g: summed.carbsPer100g,
          fatPer100g: summed.fatPer100g,
          source: "custom",
        },
        ingredientInputs
      );
      await upsertIngredients(food.id, ingredientInputs);

      clear();
      void navigate(`/search?created=${food.id}`);
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

        <h1 className="mb-2 text-xl font-bold text-gray-900">Crear alimento con ingredientes</h1>
        <p className="mb-6 text-sm text-gray-500">
          Añade alimentos existentes como ingredientes y calcularemos las macros automáticamente.
        </p>

        {/* Name */}
        <div className="mb-4">
          <label htmlFor="name" className="mb-1 block text-sm font-medium text-gray-700">
            Nombre del alimento
          </label>
          <input
            id="name"
            type="text"
            placeholder="Ej: Tortilla casera"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/20"
          />
        </div>

        {/* Category chips */}
        <div className="mb-4">
          <span className="mb-1 block text-sm font-medium text-gray-700">Categoría</span>
          <div className="flex flex-wrap gap-2">
            {Object.entries(FOOD_CATEGORIES).map(([key, { label, icon }]) => {
              const isSelected = category === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setCategory(key)}
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
        </div>

        {/* Ingredient list */}
        <div className="mb-4">
          <span className="mb-2 block text-sm font-medium text-gray-700">Ingredientes</span>

          {ingredients.length === 0 ? (
            <p className="py-2 text-sm text-gray-400">Todavía no has añadido ingredientes.</p>
          ) : (
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
            </div>
          )}

          <button
            type="button"
            onClick={handleAddIngredient}
            className="mt-3 flex w-full items-center justify-center rounded-xl border border-dashed border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-600 transition-colors hover:border-accent hover:text-accent"
          >
            + Añadir ingrediente
          </button>
        </div>

        {/* Live macro preview */}
        {preview && (
          <div className="mb-4 rounded-xl bg-white px-4 py-3 shadow-sm">
            <p className="mb-1 text-sm font-semibold text-gray-900">
              {Math.round(preview.caloriesPer100g)} kcal / 100 g
            </p>
            <p className="text-xs text-gray-400">
              P {Math.round(preview.proteinPer100g)}g · C {Math.round(preview.carbsPer100g)}g · G{" "}
              {Math.round(preview.fatPer100g)}g — Peso total {Math.round(preview.totalWeightG)}g
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
      </div>
    </div>
  );
}
