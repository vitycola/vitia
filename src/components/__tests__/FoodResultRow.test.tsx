/** @jest-environment jsdom */
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import type { SearchResult } from "@/stores/useFoodSearchStore";
import { FoodResultRow } from "../FoodResultRow";

jest.mock("@/hooks/useFavorite", () => ({
  useFavorite: jest.fn(),
}));

import { useFavorite } from "@/hooks/useFavorite";

const mockUseFavorite = useFavorite as jest.Mock;

function makeFood(): SearchResult {
  return {
    id: "food-1",
    name: "Milanesa",
    brand: "Marca X",
    caloriesPer100g: 250,
    proteinPer100g: 20,
    carbsPer100g: 10,
    fatPer100g: 12,
    servingSizeG: null,
    source: "custom",
    category: null,
    dataBasis: null,
    offProductCode: null,
    nameNormalized: "milanesa",
    imageUrl: null,
    createdAt: "2024-01-01",
    hasMissingData: false,
  };
}

describe("FoodResultRow", () => {
  const onSelect = jest.fn();

  beforeEach(() => {
    onSelect.mockReset();
    mockUseFavorite.mockReset();
  });

  it("clicking the row (not the heart) calls onSelect", () => {
    mockUseFavorite.mockReturnValue({
      isFavorite: false,
      meals: [],
      loading: false,
      setMeals: jest.fn(),
      remove: jest.fn(),
    });

    render(<FoodResultRow food={makeFood()} onSelect={onSelect} />);
    fireEvent.click(screen.getByText("Milanesa"));

    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it("tapping an unfavorited heart opens the MealPicker instead of selecting the food", () => {
    mockUseFavorite.mockReturnValue({
      isFavorite: false,
      meals: [],
      loading: false,
      setMeals: jest.fn(),
      remove: jest.fn(),
    });

    render(<FoodResultRow food={makeFood()} onSelect={onSelect} mealType="dinner" />);
    fireEvent.click(screen.getByLabelText("Añadir a favoritos"));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("confirming the MealPicker calls setMeals with selected meal types", () => {
    const setMeals = jest.fn();
    mockUseFavorite.mockReturnValue({
      isFavorite: false,
      meals: [],
      loading: false,
      setMeals,
      remove: jest.fn(),
    });

    render(<FoodResultRow food={makeFood()} onSelect={onSelect} mealType="dinner" />);
    fireEvent.click(screen.getByLabelText("Añadir a favoritos"));
    fireEvent.click(screen.getByText("Confirmar"));

    expect(setMeals).toHaveBeenCalledWith(["dinner"]);
  });

  it("tapping a filled heart shows inline confirm; Quitar calls remove()", () => {
    const remove = jest.fn();
    mockUseFavorite.mockReturnValue({
      isFavorite: true,
      meals: ["dinner"],
      loading: false,
      setMeals: jest.fn(),
      remove,
    });

    render(<FoodResultRow food={makeFood()} onSelect={onSelect} />);
    fireEvent.click(screen.getByLabelText("Quitar de favoritos"));

    expect(screen.getByText("¿Quitar de favoritos?")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Quitar"));
    expect(remove).toHaveBeenCalledTimes(1);
  });

  it("Cancelar in inline confirm does not call remove()", () => {
    const remove = jest.fn();
    mockUseFavorite.mockReturnValue({
      isFavorite: true,
      meals: ["dinner"],
      loading: false,
      setMeals: jest.fn(),
      remove,
    });

    render(<FoodResultRow food={makeFood()} onSelect={onSelect} />);
    fireEvent.click(screen.getByLabelText("Quitar de favoritos"));
    fireEvent.click(screen.getByText("Cancelar"));

    expect(remove).not.toHaveBeenCalled();
  });
});
