/** @jest-environment jsdom */
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

jest.mock("@/stores/useAiAddFlowStore", () => ({
  useAiAddFlowStore: jest.fn(),
}));
jest.mock("../SelectionScreen", () => ({ SelectionScreen: () => <div>SelectionScreen</div> }));
jest.mock("../InputScreen", () => ({ InputScreen: () => <div>InputScreen</div> }));
jest.mock("../ResultsScreen", () => ({ ResultsScreen: () => <div>ResultsScreen</div> }));
jest.mock("../ConfirmationScreen", () => ({ ConfirmationScreen: () => <div>ConfirmationScreen</div> }));

import { useAiAddFlowStore } from "@/stores/useAiAddFlowStore";
import { AiAddFlow } from "../AiAddFlow";

const mockBack = jest.fn();
const mockSetMeal = jest.fn();

function setupStore(step: string) {
  (useAiAddFlowStore as unknown as jest.Mock).mockReturnValue({
    step,
    back: mockBack,
    setMeal: mockSetMeal,
  });
}

beforeEach(() => {
  mockBack.mockReset();
  mockSetMeal.mockReset();
});

describe("AiAddFlow", () => {
  it("renders SelectionScreen at selection step", () => {
    setupStore("selection");
    render(<AiAddFlow />);
    expect(screen.getByText("SelectionScreen")).toBeInTheDocument();
  });

  it("renders InputScreen at input step", () => {
    setupStore("input");
    render(<AiAddFlow />);
    expect(screen.getByText("InputScreen")).toBeInTheDocument();
  });

  it("renders ResultsScreen at results step", () => {
    setupStore("results");
    render(<AiAddFlow />);
    expect(screen.getByText("ResultsScreen")).toBeInTheDocument();
  });

  it("renders ConfirmationScreen at confirmation step", () => {
    setupStore("confirmation");
    render(<AiAddFlow />);
    expect(screen.getByText("ConfirmationScreen")).toBeInTheDocument();
  });

  it("shows back button on non-selection screens", () => {
    setupStore("input");
    render(<AiAddFlow />);
    expect(screen.getByRole("button", { name: /volver/i })).toBeInTheDocument();
  });

  it("does not show back button on selection screen", () => {
    setupStore("selection");
    render(<AiAddFlow />);
    expect(screen.queryByRole("button", { name: /volver/i })).not.toBeInTheDocument();
  });

  it("seeds meal via setMeal when mealType prop is provided", () => {
    setupStore("selection");
    render(<AiAddFlow mealType="dinner" />);
    expect(mockSetMeal).toHaveBeenCalledWith("dinner");
  });
});
