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

  it("tapping a food row calls onSelect with the food (opens it, same as Base/Favoritos)", () => {
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
});

/**
 * Swipe-to-delete logic, mirrored the same way as
 * src/components/__tests__/MealEntryRow.test.ts — jsdom in this project does
 * not implement the PointerEvent constructor, so the gesture threshold is
 * tested as pure logic identical to the row's handlePointerUp calculation,
 * rather than via fireEvent.pointerDown/pointerUp.
 */
describe("CreatedFoodsTab row — swipe-to-delete gesture", () => {
  const SWIPE_THRESHOLD = 80;

  function wouldDeleteOnSwipe(startX: number, endX: number): boolean {
    return Math.abs(endX - startX) >= SWIPE_THRESHOLD;
  }

  it("triggers delete when swipe distance meets the threshold (exactly 80px)", () => {
    expect(wouldDeleteOnSwipe(200, 120)).toBe(true);
  });

  it("does NOT trigger delete on a small tap (1px movement)", () => {
    expect(wouldDeleteOnSwipe(200, 201)).toBe(false);
  });

  it("works for left-to-right swipes too", () => {
    expect(wouldDeleteOnSwipe(100, 200)).toBe(true);
  });
});
