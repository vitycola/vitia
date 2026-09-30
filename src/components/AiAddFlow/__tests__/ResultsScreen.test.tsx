/** @jest-environment jsdom */
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

jest.mock("@/stores/useAiAddFlowStore", () => ({
  useAiAddFlowStore: jest.fn(),
}));

import { useAiAddFlowStore } from "@/stores/useAiAddFlowStore";
import type { MealType } from "@/types";
import type { AIFoodItem } from "@/types/aiFood";
import { ResultsScreen } from "../ResultsScreen";

const mockGoToConfirmation = jest.fn();

const ITEMS: AIFoodItem[] = [
  {
    name: "Manzana",
    kcal: 80,
    protein: 0.4,
    carbs: 21,
    fat: 0.2,
    quantity: 150,
    unit: "g",
    confidence: "high",
  },
  {
    name: "Arroz",
    kcal: 200,
    protein: 4,
    carbs: 44,
    fat: 0.4,
    quantity: 100,
    unit: "g",
    confidence: "medium",
  },
];

function setupStore(results: AIFoodItem[], failedMeals: MealType[] = []) {
  (useAiAddFlowStore as unknown as jest.Mock).mockReturnValue({
    results,
    failedMeals,
    goToConfirmation: mockGoToConfirmation,
  });
}

beforeEach(() => {
  mockGoToConfirmation.mockReset();
});

describe("ResultsScreen", () => {
  it("formats macros with a comma decimal separator", () => {
    setupStore([{ ...ITEMS[0], protein: 12.5, carbs: 21, fat: 0.2 }]);
    render(<ResultsScreen />);
    expect(screen.getByText("P: 12,5g")).toBeInTheDocument();
    expect(screen.getByText("C: 21,0g")).toBeInTheDocument();
    expect(screen.getByText("G: 0,2g")).toBeInTheDocument();
  });

  it("renders items with name and confidence badge", () => {
    setupStore(ITEMS);
    render(<ResultsScreen />);
    expect(screen.getByText("Manzana")).toBeInTheDocument();
    expect(screen.getByText("Arroz")).toBeInTheDocument();
    expect(screen.getAllByText("Alta").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Media").length).toBeGreaterThan(0);
  });

  it("legend names the confidence levels Alta, Media and Baja", () => {
    setupStore(ITEMS);
    render(<ResultsScreen />);
    const legend = screen.getByText(/confianza:/i).parentElement as HTMLElement;
    expect(legend).toHaveTextContent("Alta");
    expect(legend).toHaveTextContent("Media");
    expect(legend).toHaveTextContent("Baja");
    expect(legend).not.toHaveTextContent(/editar|revisar/i);
  });

  it("shows empty state when results is empty", () => {
    setupStore([]);
    render(<ResultsScreen />);
    expect(screen.getByText(/no se han identificado alimentos/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /revisar y confirmar/i })).not.toBeInTheDocument();
  });

  it("CTA calls goToConfirmation", () => {
    setupStore(ITEMS);
    render(<ResultsScreen />);
    fireEvent.click(screen.getByRole("button", { name: /revisar y confirmar/i }));
    expect(mockGoToConfirmation).toHaveBeenCalledTimes(1);
  });
});

describe("ResultsScreen — meal groups", () => {
  const TAGGED: AIFoodItem[] = [
    { ...ITEMS[1], mealType: "lunch" },
    { ...ITEMS[0], mealType: "breakfast" },
  ];

  it("renders a header per meal, in canonical order, with its items beneath", () => {
    setupStore(TAGGED);
    render(<ResultsScreen />);
    const headers = screen.getAllByRole("heading", { level: 3 });
    expect(headers.map((h) => h.textContent)).toEqual(["Desayuno", "Almuerzo"]);
    const html = document.body.textContent ?? "";
    expect(html.indexOf("Manzana")).toBeLessThan(html.indexOf("Arroz"));
  });

  it("uses Merienda for snack", () => {
    setupStore([{ ...ITEMS[0], mealType: "snack" }]);
    render(<ResultsScreen />);
    expect(screen.getByRole("heading", { level: 3 })).toHaveTextContent("Merienda");
  });

  it("renders no meal headers for untagged (photo) results", () => {
    setupStore(ITEMS);
    render(<ResultsScreen />);
    expect(screen.queryAllByRole("heading", { level: 3 })).toHaveLength(0);
    expect(screen.getByText("Manzana")).toBeInTheDocument();
    expect(screen.getByText("Arroz")).toBeInTheDocument();
  });
});

describe("ResultsScreen — partial failure notice", () => {
  it("names the failed meals using shared labels", () => {
    setupStore([{ ...ITEMS[0], mealType: "breakfast" }], ["lunch", "dinner"]);
    render(<ResultsScreen />);
    expect(
      screen.getByText("No se pudieron analizar: Almuerzo, Cena. Vuelve a escribirlas.")
    ).toBeInTheDocument();
  });

  it("shows no notice when nothing failed", () => {
    setupStore([{ ...ITEMS[0], mealType: "breakfast" }], []);
    render(<ResultsScreen />);
    expect(screen.queryByText(/no se pudieron analizar/i)).not.toBeInTheDocument();
  });
});
