/** @jest-environment jsdom */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

jest.mock("@/stores/useAiAddFlowStore", () => ({
  useAiAddFlowStore: jest.fn(),
}));
jest.mock("@/stores/useDayStore", () => ({
  useDayStore: { getState: jest.fn() },
}));
jest.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
}));
jest.mock("@/db/repos/foods", () => ({
  createComposite: jest.fn(),
}));

const mockNavigate = jest.fn();

import { createComposite } from "@/db/repos/foods";
import { useAiAddFlowStore } from "@/stores/useAiAddFlowStore";
import { useDayStore } from "@/stores/useDayStore";
import type { AIFoodItem } from "@/types/aiFood";
import { ConfirmationScreen } from "../ConfirmationScreen";

const HIGH_ITEM: AIFoodItem = {
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
const mockCreateComposite = createComposite as jest.Mock;

function setupStore(overrides: Record<string, unknown> = {}) {
  (useAiAddFlowStore as unknown as jest.Mock).mockReturnValue({
    results: [HIGH_ITEM, LOW_ITEM],
    selections: { 0: true, 1: false }, // high=checked, low=unchecked
    quantities: { 0: 150, 1: 50 },
    selectedMeal: null,
    inputMode: "photo",
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
  mockNavigate.mockReset();
  mockAddEntry.mockReset().mockResolvedValue(undefined);
  mockCheckedMacroTotals.mockReturnValue({ kcal: 80, protein: 0.4, carbs: 21, fat: 0.2 });
  mockCreateComposite.mockReset().mockImplementation(async (food: { id: string }) => ({
    ...food,
    createdAt: new Date().toISOString(),
  }));
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

describe("ConfirmationScreen — handleAdd persistence (real foods row per item)", () => {
  it("creates a foods row with source: ai_photo when inputMode is photo", async () => {
    setupStore({ selectedMeal: "lunch", inputMode: "photo" });
    render(<ConfirmationScreen />);
    fireEvent.click(screen.getByRole("button", { name: /añadir al diario/i }));

    await waitFor(() => expect(mockAddEntry).toHaveBeenCalled());
    expect(mockCreateComposite).toHaveBeenCalledTimes(1);
    const [food, ingredients] = mockCreateComposite.mock.calls[0];
    expect(food.source).toBe("ai_photo");
    expect(food.name).toBe(HIGH_ITEM.name);
    expect(ingredients).toEqual([]);
  });

  it("creates a foods row with source: ai_list when inputMode is text", async () => {
    setupStore({ selectedMeal: "lunch", inputMode: "text" });
    render(<ConfirmationScreen />);
    fireEvent.click(screen.getByRole("button", { name: /añadir al diario/i }));

    await waitFor(() => expect(mockAddEntry).toHaveBeenCalled());
    expect(mockCreateComposite).toHaveBeenCalledTimes(1);
    const [food] = mockCreateComposite.mock.calls[0];
    expect(food.source).toBe("ai_list");
  });

  it("converts macros to per-100g using scaleAiMacros(item, 100) before creating the food row", async () => {
    setupStore({ selectedMeal: "lunch" });
    render(<ConfirmationScreen />);
    fireEvent.click(screen.getByRole("button", { name: /añadir al diario/i }));

    await waitFor(() => expect(mockAddEntry).toHaveBeenCalled());
    const [food] = mockCreateComposite.mock.calls[0];
    // HIGH_ITEM: kcal=80, quantity=150 -> per-100g = 80/150*100
    expect(food.caloriesPer100g).toBeCloseTo((80 / 150) * 100, 5);
    expect(food.proteinPer100g).toBeCloseTo((0.4 / 150) * 100, 5);
    expect(food.carbsPer100g).toBeCloseTo((21 / 150) * 100, 5);
    expect(food.fatPer100g).toBeCloseTo((0.2 / 150) * 100, 5);
  });

  it("zero-quantity guard: does not throw or produce NaN when item.quantity is 0", async () => {
    const zeroItem: AIFoodItem = { ...HIGH_ITEM, quantity: 0 };
    setupStore({
      selectedMeal: "lunch",
      results: [zeroItem],
      selections: { 0: true },
      quantities: { 0: 100 },
    });
    render(<ConfirmationScreen />);
    fireEvent.click(screen.getByRole("button", { name: /añadir al diario/i }));

    await waitFor(() => expect(mockAddEntry).toHaveBeenCalled());
    expect(mockCreateComposite).toHaveBeenCalledTimes(1);
    const [food] = mockCreateComposite.mock.calls[0];
    expect(Number.isFinite(food.caloriesPer100g)).toBe(true);
    expect(food.caloriesPer100g).toBe(0);
  });

  it("builds the meal entry from the real id returned by createComposite, not item.name", async () => {
    mockCreateComposite.mockResolvedValueOnce({
      id: "real-id-123",
      name: HIGH_ITEM.name,
      source: "ai_photo",
    });
    setupStore({ selectedMeal: "lunch" });
    render(<ConfirmationScreen />);
    fireEvent.click(screen.getByRole("button", { name: /añadir al diario/i }));

    await waitFor(() => expect(mockAddEntry).toHaveBeenCalled());
    expect(mockAddEntry).toHaveBeenCalledTimes(1);
    const [entry] = mockAddEntry.mock.calls[0];
    expect(entry.foodId).toBe("real-id-123");
  });

  it("partial failure: one item's createComposite rejects, the other item still succeeds and addEntry/navigate still fire", async () => {
    mockCreateComposite
      .mockRejectedValueOnce(new Error("create failed"))
      .mockResolvedValueOnce({ id: "real-id-2", name: LOW_ITEM.name, source: "ai_photo" });
    setupStore({
      selectedMeal: "lunch",
      selections: { 0: true, 1: true },
    });
    render(<ConfirmationScreen />);
    fireEvent.click(screen.getByRole("button", { name: /añadir al diario/i }));

    await waitFor(() => expect(mockReset).toHaveBeenCalled());
    expect(mockCreateComposite).toHaveBeenCalledTimes(2);
    expect(mockAddEntry).toHaveBeenCalledTimes(1);
    expect(mockAddEntry.mock.calls[0][0].foodId).toBe("real-id-2");
    expect(mockReset).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith("/");
  });
});
