/** @jest-environment jsdom */
/**
 * Integration test: AI Add Flow — text happy path.
 * Same scenario as the photo test but using text input mode and parseText mock.
 */
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

jest.mock("@/services/aiFood", () => ({
  analyzePhoto: jest.fn(),
  parseText: jest.fn(),
}));

jest.mock("@/stores/useDayStore", () => ({
  useDayStore: { getState: jest.fn() },
}));

const mockNavigate = jest.fn();
jest.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
}));

jest.mock("@/db/repos/mealEntries", () => ({}));
jest.mock("@/db/repos/foods", () => ({
  createComposite: jest.fn(),
}));

import { createComposite } from "@/db/repos/foods";
import * as aiService from "@/services/aiFood";
import { AiAddFlow } from "@/src/components/AiAddFlow/AiAddFlow";
import { useAiAddFlowStore } from "@/stores/useAiAddFlowStore";
import { useDayStore } from "@/stores/useDayStore";
import type { AIFoodItem } from "@/types/aiFood";

const mockParseText = aiService.parseText as jest.MockedFunction<typeof aiService.parseText>;
const mockAddEntry = jest.fn().mockResolvedValue(undefined);
const mockCreateComposite = createComposite as jest.Mock;

const FOOD_ITEM: AIFoodItem = {
  name: "Arroz cocido",
  kcal: 200,
  protein: 4,
  carbs: 44,
  fat: 0.4,
  quantity: 100,
  unit: "g",
  confidence: "medium",
};

beforeEach(() => {
  useAiAddFlowStore.getState().reset();
  mockParseText.mockReset();
  mockNavigate.mockReset();
  mockAddEntry.mockReset().mockResolvedValue(undefined);
  mockCreateComposite.mockReset().mockImplementation(async (food: { id: string }) => ({
    ...food,
    createdAt: new Date().toISOString(),
  }));
  (useDayStore.getState as jest.Mock).mockReturnValue({ addEntry: mockAddEntry });
});

describe("Text happy path integration", () => {
  it("completes text flow: select text → type → submit → confirm → diary write", async () => {
    mockParseText.mockResolvedValueOnce([FOOD_ITEM]);

    render(<AiAddFlow />);

    // Screen 1: SelectionScreen — click Lista de texto
    expect(screen.getByText("Lista de texto")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Lista de texto"));

    // Screen 2: InputScreen (text mode) — type in the first meal section (Desayuno)
    await waitFor(() => expect(screen.getAllByRole("textbox")[0]).toBeInTheDocument());
    fireEvent.change(screen.getAllByRole("textbox")[0], {
      target: { value: "100g de arroz cocido" },
    });

    // CTA should be enabled
    expect(screen.getByRole("button", { name: /analizar con ia/i })).not.toBeDisabled();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /analizar con ia/i }));
    });

    // Screen 3: ResultsScreen — item shown
    await waitFor(() => expect(screen.getByText("Arroz cocido")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /revisar y confirmar/i }));

    // Screen 4: ConfirmationScreen — select meal and add
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /añadir al diario/i })).toBeInTheDocument()
    );

    // Select breakfast
    fireEvent.click(screen.getByText("Desayuno"));

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /añadir al diario/i }));
    });

    expect(mockCreateComposite).toHaveBeenCalledTimes(1);
    const [createdFood] = mockCreateComposite.mock.calls[0];
    expect(createdFood.source).toBe("ai");

    expect(mockAddEntry).toHaveBeenCalledTimes(1);
    const entryArg = mockAddEntry.mock.calls[0][0];
    expect(entryArg.foodId).toBe(createdFood.id);
    expect(entryArg.foodName).toBe("Arroz cocido");
    expect(entryArg.mealType).toBe("breakfast");
    expect(entryArg.quantityG).toBe(100);
    expect(entryArg.calories).toBeCloseTo(200);
  });
});
