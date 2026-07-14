/** @jest-environment jsdom */
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

jest.mock("@/stores/useAiAddFlowStore", () => ({
  useAiAddFlowStore: jest.fn(),
}));
jest.mock("@/stores/useDayStore", () => ({
  useDayStore: { getState: jest.fn() },
}));
jest.mock("react-router-dom", () => ({
  useNavigate: () => jest.fn(),
}));

import { useAiAddFlowStore } from "@/stores/useAiAddFlowStore";
import { useDayStore } from "@/stores/useDayStore";
import type { AIFoodItem } from "@/types/aiFood";
import { ConfirmationScreen } from "../ConfirmationScreen";

const HIGH_ITEM: AIFoodItem = {
  foodId: "food-1",
  name: "Manzana",
  kcal: 80,
  protein: 0.4,
  carbs: 21,
  fat: 0.2,
  quantity: 150,
  unit: "g",
  confidence: "high",
};

const LOW_ITEM: AIFoodItem = {
  foodId: "food-2",
  name: "Desconocido",
  kcal: 100,
  protein: 1,
  carbs: 10,
  fat: 1,
  quantity: 50,
  unit: "g",
  confidence: "low",
};

const mockReset = jest.fn();
const mockToggleItem = jest.fn();
const mockSetQuantity = jest.fn();
const mockSetMeal = jest.fn();
const mockCheckedMacroTotals = jest
  .fn()
  .mockReturnValue({ kcal: 80, protein: 0.4, carbs: 21, fat: 0.2 });
const mockPerItemScaledMacros = jest
  .fn()
  .mockReturnValue({ kcal: 80, protein: 0.4, carbs: 21, fat: 0.2 });
const mockAddEntry = jest.fn().mockResolvedValue(undefined);

function setupStore(overrides: Record<string, unknown> = {}) {
  (useAiAddFlowStore as unknown as jest.Mock).mockReturnValue({
    results: [HIGH_ITEM, LOW_ITEM],
    selections: { 0: true, 1: false }, // high=checked, low=unchecked
    quantities: { 0: 150, 1: 50 },
    selectedMeal: null,
    reset: mockReset,
    toggleItem: mockToggleItem,
    setQuantity: mockSetQuantity,
    setMeal: mockSetMeal,
    checkedMacroTotals: mockCheckedMacroTotals,
    perItemScaledMacros: mockPerItemScaledMacros,
    ...overrides,
  });
  (useDayStore.getState as jest.Mock).mockReturnValue({ addEntry: mockAddEntry });
}

beforeEach(() => {
  mockReset.mockReset();
  mockToggleItem.mockReset();
  mockSetMeal.mockReset();
  mockAddEntry.mockReset().mockResolvedValue(undefined);
  mockCheckedMacroTotals.mockReturnValue({ kcal: 80, protein: 0.4, carbs: 21, fat: 0.2 });
});

describe("ConfirmationScreen — CTA disabled states", () => {
  it("CTA disabled when no meal is selected", () => {
    setupStore({ selectedMeal: null });
    render(<ConfirmationScreen />);
    expect(screen.getByRole("button", { name: /añadir al diario/i })).toBeDisabled();
  });

  it("CTA disabled when all items are unchecked", () => {
    setupStore({
      selectedMeal: "lunch",
      selections: { 0: false, 1: false },
    });
    render(<ConfirmationScreen />);
    expect(screen.getByRole("button", { name: /añadir al diario/i })).toBeDisabled();
  });

  it("CTA disabled when a checked item has invalid (non-positive) quantity", () => {
    setupStore({ selectedMeal: "lunch", quantities: { 0: 0, 1: 50 } });
    render(<ConfirmationScreen />);
    expect(screen.getByRole("button", { name: /añadir al diario/i })).toBeDisabled();
  });

  it("CTA enabled when meal selected, at least one item checked, and valid quantities", () => {
    setupStore({ selectedMeal: "lunch" });
    render(<ConfirmationScreen />);
    expect(screen.getByRole("button", { name: /añadir al diario/i })).not.toBeDisabled();
  });
});

describe("ConfirmationScreen — default checked state by confidence", () => {
  it("high confidence item is checked by default", () => {
    setupStore();
    render(<ConfirmationScreen />);
    const checkboxes = screen.getAllByRole("checkbox");
    // First item (high) should be checked
    expect(checkboxes[0]).toBeChecked();
  });

  it("low confidence item is unchecked by default", () => {
    setupStore();
    render(<ConfirmationScreen />);
    const checkboxes = screen.getAllByRole("checkbox");
    // Second item (low) should be unchecked
    expect(checkboxes[1]).not.toBeChecked();
  });
});

describe("ConfirmationScreen — cancel", () => {
  it("Cancel button calls store.reset", () => {
    setupStore({ selectedMeal: "lunch" });
    render(<ConfirmationScreen />);
    fireEvent.click(screen.getByRole("button", { name: /cancelar/i }));
    expect(mockReset).toHaveBeenCalledTimes(1);
  });
});

describe("ConfirmationScreen — quantity and macro preview", () => {
  it("shows per-item macro preview from perItemScaledMacros", () => {
    setupStore({ selectedMeal: "lunch" });
    render(<ConfirmationScreen />);
    // At least one macro value should be visible
    expect(screen.getAllByText(/kcal/).length).toBeGreaterThan(0);
  });
});
