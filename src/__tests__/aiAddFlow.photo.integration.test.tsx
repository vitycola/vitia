/** @jest-environment jsdom */
/**
 * Integration test: AI Add Flow — photo happy path.
 * Mocks the AI service and useDayStore.addEntry; verifies the full wizard
 * from selecting photo → submitting → confirming → diary write.
 */
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

// Mock the AI service
jest.mock("@/services/aiFood", () => ({
  analyzePhoto: jest.fn(),
  parseText: jest.fn(),
}));

// compressImage uses Canvas/URL.createObjectURL — not available in jsdom
jest.mock("@/lib/compressImage", () => ({
  compressImage: jest.fn((file: File) => Promise.resolve(file)),
}));

// Mock useDayStore — we spy on addEntry
jest.mock("@/stores/useDayStore", () => ({
  useDayStore: { getState: jest.fn() },
}));

// Mock react-router-dom navigate
const mockNavigate = jest.fn();
jest.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
}));

// Mock db imports that use import.meta (Vite-only)
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

const mockAnalyzePhoto = aiService.analyzePhoto as jest.MockedFunction<
  typeof aiService.analyzePhoto
>;
const mockAddEntry = jest.fn().mockResolvedValue(undefined);
const mockCreateComposite = createComposite as jest.Mock;

const FOOD_ITEM: AIFoodItem = {
  name: "Pollo a la plancha",
  kcal: 165,
  protein: 31,
  carbs: 0,
  fat: 3.6,
  quantity: 100,
  unit: "g",
  confidence: "high",
};

beforeEach(() => {
  useAiAddFlowStore.getState().reset();
  mockAnalyzePhoto.mockReset();
  mockNavigate.mockReset();
  mockAddEntry.mockReset().mockResolvedValue(undefined);
  mockCreateComposite.mockReset().mockImplementation(async (food: { id: string }) => ({
    ...food,
    createdAt: new Date().toISOString(),
  }));
  (useDayStore.getState as jest.Mock).mockReturnValue({ addEntry: mockAddEntry });
});

describe("Photo happy path integration", () => {
  it("completes photo flow: select photo → submit → confirm → diary write", async () => {
    mockAnalyzePhoto.mockResolvedValueOnce([FOOD_ITEM]);

    render(<AiAddFlow />);

    // Screen 1: SelectionScreen — click Foto
    expect(screen.getByText("Foto")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Foto"));

    // Screen 2: InputScreen (photo mode) — select a file
    await waitFor(() => expect(screen.getByTestId("photo-file-input")).toBeInTheDocument());
    const file = new File(["data"], "meal.jpg", { type: "image/jpeg" });
    fireEvent.change(screen.getByTestId("photo-file-input"), { target: { files: [file] } });

    // Submit CTA appears
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /analizar con ia/i })).toBeInTheDocument()
    );

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /analizar con ia/i }));
    });

    // Screen 3: ResultsScreen — item shown
    await waitFor(() => expect(screen.getByText("Pollo a la plancha")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /revisar y confirmar/i }));

    // Screen 4: ConfirmationScreen — select meal and add
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /añadir al diario/i })).toBeInTheDocument()
    );

    // Select meal
    fireEvent.click(screen.getByText("Almuerzo"));

    // Add to diary
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /añadir al diario/i }));
    });

    // A real foods row is created (source: ai), and addEntry references its id
    expect(mockCreateComposite).toHaveBeenCalledTimes(1);
    const [createdFood] = mockCreateComposite.mock.calls[0];
    expect(createdFood.source).toBe("ai_photo");

    expect(mockAddEntry).toHaveBeenCalledTimes(1);
    const entryArg = mockAddEntry.mock.calls[0][0];
    expect(entryArg.foodId).toBe(createdFood.id);
    expect(entryArg.foodName).toBe("Pollo a la plancha");
    expect(entryArg.mealType).toBe("lunch");
    expect(entryArg.quantityG).toBe(100);
    expect(entryArg.calories).toBeCloseTo(165);
  });
});
