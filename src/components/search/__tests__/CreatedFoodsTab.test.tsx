/** @jest-environment jsdom */
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import type { Food } from "@/db/schema";
import { CreatedFoodsTab } from "../CreatedFoodsTab";

jest.mock("@/hooks/useCreatedFoodsList", () => ({
  useCreatedFoodsList: jest.fn(),
}));

jest.mock("@/hooks/useSwipeReveal", () => ({
  useSwipeReveal: jest.fn(),
}));

const mockNavigate = jest.fn();
jest.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
}));

import { useCreatedFoodsList } from "@/hooks/useCreatedFoodsList";
import { useSwipeReveal } from "@/hooks/useSwipeReveal";

const mockUseCreatedFoodsList = useCreatedFoodsList as jest.Mock;
const mockUseSwipeReveal = useSwipeReveal as jest.Mock;

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
    dataBasis: null,
    createdAt: "2024-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("CreatedFoodsTab", () => {
  const onSelect = jest.fn();
  const remove = jest.fn();
  const close = jest.fn();

  beforeEach(() => {
    onSelect.mockReset();
    mockNavigate.mockReset();
    mockUseCreatedFoodsList.mockReset();
    remove.mockReset();
    remove.mockResolvedValue(undefined);
    close.mockReset();
    // Default: row closed, swipe handlers are no-ops — most tests only
    // exercise tap-to-select and the always-present delete button, not the
    // drag gesture itself (covered by hooks/__tests__/useSwipeReveal.test.ts).
    mockUseSwipeReveal.mockReturnValue({
      translateX: 0,
      isOpen: false,
      isDragging: false,
      onPointerDown: jest.fn(),
      onPointerMove: jest.fn(),
      onPointerUp: jest.fn(),
      close,
    });
  });

  function mockList(overrides: Partial<ReturnType<typeof useCreatedFoodsList>> = {}) {
    mockUseCreatedFoodsList.mockReturnValue({
      items: [],
      loading: false,
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

  it("tapping a food row (closed) calls onSelect with the food, opening it like Base/Favoritos", () => {
    const food = makeFood({ id: "select-me", name: "Tortilla casera" });
    mockList({ items: [food] });

    render(<CreatedFoodsTab onSelect={onSelect} query="" />);
    fireEvent.click(screen.getByText("Tortilla casera"));

    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: "select-me" }));
  });

  it("tapping the front content while swiped open closes it instead of calling onSelect", () => {
    const food = makeFood({ id: "food-1", name: "Tortilla casera" });
    mockList({ items: [food] });
    mockUseSwipeReveal.mockReturnValue({
      translateX: -96,
      isOpen: true,
      isDragging: false,
      onPointerDown: jest.fn(),
      onPointerMove: jest.fn(),
      onPointerUp: jest.fn(),
      close,
    });

    render(<CreatedFoodsTab onSelect={onSelect} query="" />);
    fireEvent.click(screen.getByText("Tortilla casera"));

    expect(close).toHaveBeenCalledTimes(1);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("renders a red 'Eliminar' action behind every row, and tapping it deletes without a confirm dialog", () => {
    const food = makeFood({ id: "delete-me", name: "Tortilla casera" });
    mockList({ items: [food] });

    render(<CreatedFoodsTab onSelect={onSelect} query="" />);
    fireEvent.click(screen.getByLabelText("Eliminar Tortilla casera"));

    expect(remove).toHaveBeenCalledWith("delete-me");
    expect(screen.queryByText(/¿eliminar/i)).not.toBeInTheDocument();
  });

  it("passes the external query prop down to useCreatedFoodsList", () => {
    mockList();

    render(<CreatedFoodsTab onSelect={onSelect} query="arroz" />);

    expect(mockUseCreatedFoodsList).toHaveBeenCalledWith("arroz");
  });
});
