/** @jest-environment jsdom */
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import type { FavoriteListItem } from "@/hooks/useFavoritesList";
import type { MealType } from "@/types";
import { FavoritesTab } from "../FavoritesTab";

jest.mock("@/hooks/useFavoritesList", () => ({
  useFavoritesList: jest.fn(),
}));

import { useFavoritesList } from "@/hooks/useFavoritesList";

const mockUseFavoritesList = useFavoritesList as jest.Mock;

function makeFood(
  overrides: Partial<{ id: string; name: string; otherMeals: MealType[] }> = {}
): FavoriteListItem {
  return {
    id: "food-1",
    name: "Arroz blanco",
    brand: null,
    caloriesPer100g: 130,
    proteinPer100g: 2.7,
    carbsPer100g: 28,
    fatPer100g: 0.3,
    servingSizeG: null,
    source: "custom" as const,
    category: null,
    offProductCode: null,
    nameNormalized: "arroz blanco",
    imageUrl: null,
    createdAt: "2024-01-01",
    otherMeals: [],
    ...overrides,
  };
}

describe("FavoritesTab", () => {
  const onSelect = jest.fn();

  beforeEach(() => {
    onSelect.mockReset();
    mockUseFavoritesList.mockReset();
  });

  it("shows loading state", () => {
    mockUseFavoritesList.mockReturnValue({
      sections: [],
      loading: true,
      remove: jest.fn(),
    });

    render(<FavoritesTab mealType="lunch" onSelect={onSelect} query="" />);
    expect(screen.getByText("Cargando…")).toBeInTheDocument();
  });

  it("shows empty state when there are no favorites and no query", () => {
    mockUseFavoritesList.mockReturnValue({
      sections: [],
      loading: false,
      remove: jest.fn(),
    });

    render(<FavoritesTab mealType="lunch" onSelect={onSelect} query="" />);
    expect(screen.getByText("Sin favoritos todavía")).toBeInTheDocument();
  });

  it("renders meal-type sections in fixed order followed by unassigned", () => {
    mockUseFavoritesList.mockReturnValue({
      sections: [
        { mealType: "breakfast", items: [makeFood({ id: "a", name: "Avena" })] },
        { mealType: "dinner", items: [makeFood({ id: "b", name: "Pollo" })] },
        { mealType: null, items: [makeFood({ id: "c", name: "Manzana" })] },
      ],
      loading: false,
      remove: jest.fn(),
    });

    render(<FavoritesTab mealType="lunch" onSelect={onSelect} query="" />);

    const labels = screen.getAllByText(/Desayuno|Cena|Sin asignar/);
    expect(labels.map((l) => l.textContent)).toEqual(["Desayuno", "Cena", "Sin asignar"]);
    expect(screen.getByText("Avena")).toBeInTheDocument();
    expect(screen.getByText("Pollo")).toBeInTheDocument();
    expect(screen.getByText("Manzana")).toBeInTheDocument();
  });

  it("annotates a food favorited under multiple meal types", () => {
    mockUseFavoritesList.mockReturnValue({
      sections: [
        {
          mealType: "lunch",
          items: [makeFood({ id: "shared", name: "Arroz blanco", otherMeals: ["dinner"] })],
        },
      ],
      loading: false,
      remove: jest.fn(),
    });

    render(<FavoritesTab mealType="lunch" onSelect={onSelect} query="" />);
    expect(screen.getByText(/también en Cena/)).toBeInTheDocument();
  });

  it("shows a no-results state when query has no matches", () => {
    mockUseFavoritesList.mockReturnValue({
      sections: [],
      loading: false,
      remove: jest.fn(),
    });

    render(<FavoritesTab mealType="lunch" onSelect={onSelect} query="zzz" />);
    expect(screen.getByText(/Sin resultados para/)).toBeInTheDocument();
  });

  it("passes the external query prop down to useFavoritesList", () => {
    mockUseFavoritesList.mockReturnValue({
      sections: [{ mealType: "lunch", items: [makeFood()] }],
      loading: false,
      remove: jest.fn(),
    });

    render(<FavoritesTab mealType="lunch" onSelect={onSelect} query="arroz" />);

    expect(mockUseFavoritesList).toHaveBeenCalledWith("arroz");
  });

  it("clicking a favorite row calls onSelect with the food", () => {
    const food = makeFood({ id: "select-me", name: "Arroz blanco" });
    mockUseFavoritesList.mockReturnValue({
      sections: [{ mealType: "lunch", items: [food] }],
      loading: false,
      remove: jest.fn(),
    });

    render(<FavoritesTab mealType="lunch" onSelect={onSelect} query="" />);
    fireEvent.click(screen.getByText("Arroz blanco"));

    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: "select-me" }));
  });

  it("tapping the heart shows inline Cancelar/Quitar confirmation, and Quitar removes the whole favorite", () => {
    const remove = jest.fn();
    const food = makeFood({ id: "remove-me", name: "Arroz blanco" });
    mockUseFavoritesList.mockReturnValue({
      sections: [{ mealType: "lunch", items: [food] }],
      loading: false,
      remove,
    });

    render(<FavoritesTab mealType="lunch" onSelect={onSelect} query="" />);
    fireEvent.click(screen.getByLabelText("Quitar de favoritos"));

    expect(screen.getByText("¿Quitar de favoritos?")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Quitar"));
    expect(remove).toHaveBeenCalledWith("remove-me");
  });

  it("tapping Cancelar in the inline confirm does not remove the favorite", () => {
    const remove = jest.fn();
    const food = makeFood({ id: "keep-me", name: "Arroz blanco" });
    mockUseFavoritesList.mockReturnValue({
      sections: [{ mealType: "lunch", items: [food] }],
      loading: false,
      remove,
    });

    render(<FavoritesTab mealType="lunch" onSelect={onSelect} query="" />);
    fireEvent.click(screen.getByLabelText("Quitar de favoritos"));
    fireEvent.click(screen.getByText("Cancelar"));

    expect(remove).not.toHaveBeenCalled();
    expect(screen.queryByText("¿Quitar de favoritos?")).not.toBeInTheDocument();
  });
});
