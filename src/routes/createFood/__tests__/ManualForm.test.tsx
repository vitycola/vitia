/** @jest-environment jsdom */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

const mockNavigate = jest.fn();
const mockUseParams = jest.fn(() => ({}) as { foodId?: string });
jest.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
  useParams: () => mockUseParams(),
}));

const mockCreateComposite = jest.fn();
const mockGetById = jest.fn();
const mockUpdate = jest.fn();
jest.mock("@/db/repos/foods", () => ({
  createComposite: (...args: unknown[]) => mockCreateComposite(...args),
  getById: (...args: unknown[]) => mockGetById(...args),
  update: (...args: unknown[]) => mockUpdate(...args),
}));

const mockIncrementOffCategoryCorrection = jest.fn();
jest.mock("@/db/repos/offCategoryCorrections", () => ({
  incrementOffCategoryCorrection: (...args: unknown[]) =>
    mockIncrementOffCategoryCorrection(...args),
}));

jest.mock("@/lib/id", () => ({ generateId: () => "generated-id" }));

import type { Food } from "@/db/schema";
import { ManualFormRoute } from "../ManualForm";

function makeFood(overrides: Partial<Food> = {}): Food {
  return {
    id: "food-1",
    name: "Yogur casero",
    brand: null,
    caloriesPer100g: 60,
    proteinPer100g: 4,
    carbsPer100g: 6,
    fatPer100g: 2,
    servingSizeG: 200,
    source: "custom",
    category: null,
    offProductCode: null,
    nameNormalized: "yogur casero",
    imageUrl: null,
    createdAt: "2024-01-01",
    ...overrides,
  } as Food;
}

describe("ManualFormRoute", () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockUseParams.mockReturnValue({});
    mockCreateComposite.mockReset();
    mockCreateComposite.mockResolvedValue({ id: "generated-id" });
    mockGetById.mockReset();
    mockUpdate.mockReset();
    mockUpdate.mockResolvedValue(makeFood());
    mockIncrementOffCategoryCorrection.mockReset();
    mockIncrementOffCategoryCorrection.mockResolvedValue(undefined);
  });

  function fillValidForm() {
    fireEvent.change(screen.getByLabelText(/nombre del alimento/i), {
      target: { value: "Tortilla casera" },
    });
    fireEvent.change(screen.getByLabelText(/^categoría/i), { target: { value: "huevos" } });
    // huevos has a known cooking factor (COOKING_FACTORS) — dataBasis is
    // required once that category is selected (design D6.3).
    fireEvent.change(screen.getByLabelText(/tipo de dato|crudo.*cocido/i), {
      target: { value: "crudo" },
    });
    fireEvent.change(screen.getByLabelText(/peso de la porción/i), {
      target: { value: "120" },
    });
    fireEvent.change(screen.getByLabelText(/calorías/i), { target: { value: "150" } });
    fireEvent.change(screen.getByLabelText(/proteínas/i), { target: { value: "10" } });
    fireEvent.change(screen.getByLabelText(/carbohidratos/i), { target: { value: "5" } });
    fireEvent.change(screen.getByLabelText(/grasas/i), { target: { value: "8" } });
  }

  it("renders category as a dropdown listing every option from lib/foodCategories", () => {
    render(<ManualFormRoute />);
    const select = screen.getByLabelText(/^categoría/i) as HTMLSelectElement;
    const optionLabels = Array.from(select.options).map((o) => o.textContent);
    expect(optionLabels.some((label) => label?.includes("Huevos"))).toBe(true);
    expect(optionLabels.some((label) => label?.includes("Vegetales"))).toBe(true);
  });

  it("valid save calls createComposite with entered values", async () => {
    render(<ManualFormRoute />);
    fillValidForm();
    fireEvent.click(screen.getByRole("button", { name: /guardar/i }));

    await waitFor(() => expect(mockCreateComposite).toHaveBeenCalledTimes(1));
    const [food, ingredients] = mockCreateComposite.mock.calls[0];
    expect(food).toMatchObject({
      name: "Tortilla casera",
      category: "huevos",
      servingSizeG: 120,
      caloriesPer100g: 150,
      proteinPer100g: 10,
      carbsPer100g: 5,
      fatPer100g: 8,
      source: "custom",
    });
    expect(ingredients).toEqual([]);
  });

  it("blocks save when name is empty", async () => {
    render(<ManualFormRoute />);
    fillValidForm();
    fireEvent.change(screen.getByLabelText(/nombre del alimento/i), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: /guardar/i }));

    await waitFor(() => expect(screen.getByText(/introduce el nombre/i)).toBeInTheDocument());
    expect(mockCreateComposite).not.toHaveBeenCalled();
  });

  it("blocks save when a macro is negative", async () => {
    render(<ManualFormRoute />);
    fillValidForm();
    fireEvent.change(screen.getByLabelText(/proteínas/i), { target: { value: "-5" } });
    fireEvent.click(screen.getByRole("button", { name: /guardar/i }));

    await waitFor(() => expect(mockCreateComposite).not.toHaveBeenCalled());
  });

  it("blocks save when portion weight is zero", async () => {
    render(<ManualFormRoute />);
    fillValidForm();
    fireEvent.change(screen.getByLabelText(/peso de la porción/i), { target: { value: "0" } });
    fireEvent.click(screen.getByRole("button", { name: /guardar/i }));

    await waitFor(() => expect(mockCreateComposite).not.toHaveBeenCalled());
  });

  it("saves successfully without selecting a category (category is optional)", async () => {
    render(<ManualFormRoute />);
    fireEvent.change(screen.getByLabelText(/nombre del alimento/i), {
      target: { value: "Tortilla casera" },
    });
    fireEvent.change(screen.getByLabelText(/peso de la porción/i), {
      target: { value: "120" },
    });
    fireEvent.change(screen.getByLabelText(/calorías/i), { target: { value: "150" } });
    fireEvent.change(screen.getByLabelText(/proteínas/i), { target: { value: "10" } });
    fireEvent.change(screen.getByLabelText(/carbohidratos/i), { target: { value: "5" } });
    fireEvent.change(screen.getByLabelText(/grasas/i), { target: { value: "8" } });
    fireEvent.click(screen.getByRole("button", { name: /guardar/i }));

    await waitFor(() => expect(mockCreateComposite).toHaveBeenCalledTimes(1));
    const [food] = mockCreateComposite.mock.calls[0];
    expect(food).toMatchObject({ name: "Tortilla casera", category: null });
  });

  describe("required dataBasis when category has a cooking factor", () => {
    it("does not show a dataBasis control for a category with no cooking factor", () => {
      render(<ManualFormRoute />);
      fireEvent.change(screen.getByLabelText(/^categoría/i), { target: { value: "bebidas" } });
      expect(screen.queryByLabelText(/tipo de dato|crudo.*cocido/i)).not.toBeInTheDocument();
    });

    it("shows a required dataBasis control once a convertible category is selected", () => {
      render(<ManualFormRoute />);
      fireEvent.change(screen.getByLabelText(/^categoría/i), { target: { value: "carnes" } });
      expect(screen.getByLabelText(/tipo de dato|crudo.*cocido/i)).toBeInTheDocument();
    });

    it("blocks save when category has a factor and dataBasis is unset", async () => {
      render(<ManualFormRoute />);
      fillValidForm();
      fireEvent.change(screen.getByLabelText(/^categoría/i), { target: { value: "carnes" } });
      fireEvent.click(screen.getByRole("button", { name: /guardar/i }));

      await waitFor(() => expect(mockCreateComposite).not.toHaveBeenCalled());
    });

    it("saves successfully when category has a factor and dataBasis is set", async () => {
      render(<ManualFormRoute />);
      fillValidForm();
      fireEvent.change(screen.getByLabelText(/^categoría/i), { target: { value: "carnes" } });
      fireEvent.change(screen.getByLabelText(/tipo de dato|crudo.*cocido/i), {
        target: { value: "crudo" },
      });
      fireEvent.click(screen.getByRole("button", { name: /guardar/i }));

      await waitFor(() => expect(mockCreateComposite).toHaveBeenCalledTimes(1));
      const [food] = mockCreateComposite.mock.calls[0];
      expect(food).toMatchObject({ category: "carnes", dataBasis: "crudo" });
    });

    it("saves successfully without a dataBasis for a non-convertible category", async () => {
      render(<ManualFormRoute />);
      // Fill everything except category/dataBasis directly (not via
      // fillValidForm, which defaults to a convertible category + basis) —
      // this test specifically exercises a category that never shows the
      // dataBasis control at all.
      fireEvent.change(screen.getByLabelText(/nombre del alimento/i), {
        target: { value: "Bebida energética" },
      });
      fireEvent.change(screen.getByLabelText(/^categoría/i), { target: { value: "bebidas" } });
      fireEvent.change(screen.getByLabelText(/peso de la porción/i), {
        target: { value: "250" },
      });
      fireEvent.change(screen.getByLabelText(/calorías/i), { target: { value: "45" } });
      fireEvent.change(screen.getByLabelText(/proteínas/i), { target: { value: "0" } });
      fireEvent.change(screen.getByLabelText(/carbohidratos/i), { target: { value: "11" } });
      fireEvent.change(screen.getByLabelText(/grasas/i), { target: { value: "0" } });
      fireEvent.click(screen.getByRole("button", { name: /guardar/i }));

      await waitFor(() => expect(mockCreateComposite).toHaveBeenCalledTimes(1));
      const [food] = mockCreateComposite.mock.calls[0];
      expect(food).toMatchObject({ category: "bebidas", dataBasis: null });
    });
  });

  describe("edit mode (foodId route param present)", () => {
    beforeEach(() => {
      mockUseParams.mockReturnValue({ foodId: "food-1" });
    });

    it("loads the existing food and prefills the form", async () => {
      mockGetById.mockResolvedValue(makeFood({ name: "Yogur casero", category: "lacteos" }));

      render(<ManualFormRoute />);

      await waitFor(() => expect(screen.getByDisplayValue("Yogur casero")).toBeInTheDocument());
      expect(screen.getByDisplayValue("200")).toBeInTheDocument();
      expect(screen.getByLabelText(/^categoría/i)).toHaveValue("lacteos");
    });

    it("shows 'Editar alimento' as the title and 'Guardar cambios' as the CTA", async () => {
      mockGetById.mockResolvedValue(makeFood());

      render(<ManualFormRoute />);

      await waitFor(() => expect(screen.getByText("Editar alimento")).toBeInTheDocument());
      expect(screen.getByRole("button", { name: "Guardar cambios" })).toBeInTheDocument();
    });

    it("submitting calls update() with the food id instead of createComposite()", async () => {
      mockGetById.mockResolvedValue(makeFood({ name: "Yogur casero" }));

      render(<ManualFormRoute />);
      await waitFor(() => expect(screen.getByDisplayValue("Yogur casero")).toBeInTheDocument());

      fireEvent.change(screen.getByLabelText(/nombre del alimento/i), {
        target: { value: "Yogur casero (actualizado)" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));

      await waitFor(() => expect(mockUpdate).toHaveBeenCalledTimes(1));
      expect(mockUpdate).toHaveBeenCalledWith(
        "food-1",
        expect.objectContaining({ name: "Yogur casero (actualizado)" })
      );
      expect(mockCreateComposite).not.toHaveBeenCalled();
      expect(mockNavigate).toHaveBeenCalledWith("/search?created=food-1");
    });

    describe("OFF category-correction counter (design D5)", () => {
      it("increments the counter when an OFF-sourced food's category is manually changed", async () => {
        mockGetById.mockResolvedValue(makeFood({ source: "openfoodfacts", category: "lacteos" }));

        render(<ManualFormRoute />);
        await waitFor(() => expect(screen.getByLabelText(/^categoría/i)).toHaveValue("lacteos"));

        fireEvent.change(screen.getByLabelText(/^categoría/i), { target: { value: "huevos" } });
        fireEvent.change(screen.getByLabelText(/tipo de dato|crudo.*cocido/i), {
          target: { value: "crudo" },
        });
        fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));

        await waitFor(() => expect(mockUpdate).toHaveBeenCalledTimes(1));
        expect(mockIncrementOffCategoryCorrection).toHaveBeenCalledTimes(1);
      });

      it("does not increment the counter when the category is left unchanged", async () => {
        mockGetById.mockResolvedValue(makeFood({ source: "openfoodfacts", category: "lacteos" }));

        render(<ManualFormRoute />);
        await waitFor(() => expect(screen.getByLabelText(/^categoría/i)).toHaveValue("lacteos"));

        fireEvent.change(screen.getByLabelText(/nombre del alimento/i), {
          target: { value: "Yogur casero (renombrado)" },
        });
        fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));

        await waitFor(() => expect(mockUpdate).toHaveBeenCalledTimes(1));
        expect(mockIncrementOffCategoryCorrection).not.toHaveBeenCalled();
      });

      it("does not increment the counter for a custom (non-OFF) food's category change", async () => {
        mockGetById.mockResolvedValue(makeFood({ source: "custom", category: "lacteos" }));

        render(<ManualFormRoute />);
        await waitFor(() => expect(screen.getByLabelText(/^categoría/i)).toHaveValue("lacteos"));

        fireEvent.change(screen.getByLabelText(/^categoría/i), { target: { value: "huevos" } });
        fireEvent.change(screen.getByLabelText(/tipo de dato|crudo.*cocido/i), {
          target: { value: "crudo" },
        });
        fireEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));

        await waitFor(() => expect(mockUpdate).toHaveBeenCalledTimes(1));
        expect(mockIncrementOffCategoryCorrection).not.toHaveBeenCalled();
      });
    });
  });
});
