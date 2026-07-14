/** @jest-environment jsdom */
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

jest.mock("@/stores/useAiAddFlowStore", () => ({
  useAiAddFlowStore: jest.fn(),
}));

import { useAiAddFlowStore } from "@/stores/useAiAddFlowStore";
import type { AIFoodItem } from "@/types/aiFood";
import { ResultsScreen } from "../ResultsScreen";

const mockGoToConfirmation = jest.fn();

const ITEMS: AIFoodItem[] = [
  { foodId: "f1", name: "Manzana", kcal: 80, protein: 0.4, carbs: 21, fat: 0.2, quantity: 150, unit: "g", confidence: "high" },
  { foodId: "f2", name: "Arroz", kcal: 200, protein: 4, carbs: 44, fat: 0.4, quantity: 100, unit: "g", confidence: "medium" },
];

function setupStore(results: AIFoodItem[]) {
  (useAiAddFlowStore as unknown as jest.Mock).mockReturnValue({
    results,
    goToConfirmation: mockGoToConfirmation,
  });
}

beforeEach(() => {
  mockGoToConfirmation.mockReset();
});

describe("ResultsScreen", () => {
  it("renders items with name and confidence badge", () => {
    setupStore(ITEMS);
    render(<ResultsScreen />);
    expect(screen.getByText("Manzana")).toBeInTheDocument();
    expect(screen.getByText("Arroz")).toBeInTheDocument();
    expect(screen.getAllByText("Alta").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Revisar").length).toBeGreaterThan(0);
  });

  it("shows empty state when results is empty", () => {
    setupStore([]);
    render(<ResultsScreen />);
    expect(screen.getByText(/no se identificaron alimentos/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /revisar y confirmar/i })).not.toBeInTheDocument();
  });

  it("CTA calls goToConfirmation", () => {
    setupStore(ITEMS);
    render(<ResultsScreen />);
    fireEvent.click(screen.getByRole("button", { name: /revisar y confirmar/i }));
    expect(mockGoToConfirmation).toHaveBeenCalledTimes(1);
  });
});
