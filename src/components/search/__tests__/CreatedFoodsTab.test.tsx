/** @jest-environment jsdom */
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import type { Food } from "@/db/schema";
import { CreatedFoodsTab } from "../CreatedFoodsTab";

jest.mock("@/hooks/useCreatedFoodsList", () => ({
  useCreatedFoodsList: jest.fn(),
}));

const mockNavigate = jest.fn();
jest.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
}));

import { useCreatedFoodsList } from "@/hooks/useCreatedFoodsList";

const mockUseCreatedFoodsList = useCreatedFoodsList as jest.Mock;

function makeFood(overrides: Partial<Food> = {}): Food {
  return {
    id: "food-1",
    name: "Tortilla casera",
    brand: null,
    caloriesPer100g: 150,
    proteinPer100g: 10,
    carbsPer100g: 5,
    fatPer100g: 8,
    servingSizeG: 120,
    source: "custom",
    offProductCode: null,
    nameNormalized: "tortilla casera",
    imageUrl: null,
    category: "huevos",
    createdAt: "2024-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("CreatedFoodsTab", () => {
  const onSelect = jest.fn();
  const remove = jest.fn();

  beforeEach(() => {
    onSelect.mockReset();
    mockNavigate.mockReset();
    mockUseCreatedFoodsList.mockReset();
    remove.mockReset();
    remove.mockResolvedValue(undefined);
  });

  function mockList(overrides: Partial<ReturnType<typeof useCreatedFoodsList>> = {}) {
    mockUseCreatedFoodsList.mockReturnValue({
      items: [],
      loading: false,
      compositeIds: new Set<string>(),
      remove,
      ...overrides,
    });
  }

  it("shows loading state", () => {
    mockList({ loading: true });

    render(<CreatedFoodsTab onSelect={onSelect} query="" />);
    expect(screen.getByText("Cargando…")).toBeInTheDocument();
  });

  it("shows an empty-state message and a 'Crear alimento' CTA when there are no created foods", () => {
    mockList();

    render(<CreatedFoodsTab onSelect={onSelect} query="" />);
    expect(screen.getByText(/Todavía no has creado ningún alimento/i)).toBeInTheDocument();
    expect(screen.getByText("Crear alimento")).toBeInTheDocument();
  });

  it("tapping the CTA navigates to /create-food", () => {
    mockList();

    render(<CreatedFoodsTab onSelect={onSelect} query="" />);
    fireEvent.click(screen.getByText("Crear alimento"));

    expect(mockNavigate).toHaveBeenCalledWith("/create-food");
  });

  it("keeps the 'Crear alimento' CTA visible when the list already has items", () => {
    mockList({ items: [makeFood({ id: "a" })] });

    render(<CreatedFoodsTab onSelect={onSelect} query="" />);

    expect(screen.getByText("Crear alimento")).toBeInTheDocument();
  });

  it("renders a flat list of created foods with no grouping", () => {
    mockList({
      items: [
        makeFood({ id: "a", name: "Tortilla casera" }),
        makeFood({ id: "b", name: "Ensalada de garbanzos" }),
      ],
    });

    render(<CreatedFoodsTab onSelect={onSelect} query="" />);

    expect(screen.getByText("Tortilla casera")).toBeInTheDocument();
    expect(screen.getByText("Ensalada de garbanzos")).toBeInTheDocument();
  });

  it("clicking a food row calls onSelect with the food", () => {
    const food = makeFood({ id: "select-me", name: "Tortilla casera" });
    mockList({ items: [food] });

    render(<CreatedFoodsTab onSelect={onSelect} query="" />);
    fireEvent.click(screen.getByText("Tortilla casera"));

    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: "select-me" }));
  });

  it("passes the external query prop down to useCreatedFoodsList", () => {
    mockList();

    render(<CreatedFoodsTab onSelect={onSelect} query="arroz" />);

    expect(mockUseCreatedFoodsList).toHaveBeenCalledWith("arroz");
  });

  it("shows an edit-recipe affordance for composite foods only", () => {
    const composite = makeFood({ id: "composite-1", name: "Tortilla casera" });
    const manual = makeFood({ id: "manual-1", name: "Yogur casero" });
    mockList({ items: [composite, manual], compositeIds: new Set(["composite-1"]) });

    render(<CreatedFoodsTab onSelect={onSelect} query="" />);

    expect(screen.getByLabelText("Editar receta de Tortilla casera")).toBeInTheDocument();
    expect(screen.queryByLabelText("Editar receta de Yogur casero")).not.toBeInTheDocument();
  });

  it("tapping the edit-recipe affordance navigates to the recipe-detail route without calling onSelect", () => {
    const composite = makeFood({ id: "composite-1", name: "Tortilla casera" });
    mockList({ items: [composite], compositeIds: new Set(["composite-1"]) });

    render(<CreatedFoodsTab onSelect={onSelect} query="" />);
    fireEvent.click(screen.getByLabelText("Editar receta de Tortilla casera"));

    expect(mockNavigate).toHaveBeenCalledWith("/create-food/composite-1/edit");
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("shows a delete affordance on every row, manual or composite", () => {
    const composite = makeFood({ id: "composite-1", name: "Tortilla casera" });
    const manual = makeFood({ id: "manual-1", name: "Yogur casero" });
    mockList({ items: [composite, manual], compositeIds: new Set(["composite-1"]) });

    render(<CreatedFoodsTab onSelect={onSelect} query="" />);

    expect(screen.getByLabelText("Eliminar Tortilla casera")).toBeInTheDocument();
    expect(screen.getByLabelText("Eliminar Yogur casero")).toBeInTheDocument();
  });

  it("tapping delete shows an inline confirm before removing, without calling onSelect", () => {
    const food = makeFood({ id: "food-1", name: "Yogur casero" });
    mockList({ items: [food] });

    render(<CreatedFoodsTab onSelect={onSelect} query="" />);
    fireEvent.click(screen.getByLabelText("Eliminar Yogur casero"));

    expect(screen.getByText(/¿Eliminar este alimento\?/i)).toBeInTheDocument();
    expect(remove).not.toHaveBeenCalled();
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("confirming delete calls remove() with the food id", () => {
    const food = makeFood({ id: "food-1", name: "Yogur casero" });
    mockList({ items: [food] });

    render(<CreatedFoodsTab onSelect={onSelect} query="" />);
    fireEvent.click(screen.getByLabelText("Eliminar Yogur casero"));
    fireEvent.click(screen.getByRole("button", { name: "Eliminar" }));

    expect(remove).toHaveBeenCalledWith("food-1");
  });

  it("cancelling the delete confirm leaves the food untouched", () => {
    const food = makeFood({ id: "food-1", name: "Yogur casero" });
    mockList({ items: [food] });

    render(<CreatedFoodsTab onSelect={onSelect} query="" />);
    fireEvent.click(screen.getByLabelText("Eliminar Yogur casero"));
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(remove).not.toHaveBeenCalled();
    expect(screen.getByText("Yogur casero")).toBeInTheDocument();
  });
});
