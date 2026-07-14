/** @jest-environment jsdom */
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

jest.mock("@/stores/useAiAddFlowStore", () => ({
  useAiAddFlowStore: jest.fn(),
}));

import { useAiAddFlowStore } from "@/stores/useAiAddFlowStore";
import { SelectionScreen } from "../SelectionScreen";

const mockChooseMode = jest.fn();

function setupStore() {
  (useAiAddFlowStore as unknown as jest.Mock).mockReturnValue({
    chooseMode: mockChooseMode,
  });
}

beforeEach(() => {
  mockChooseMode.mockReset();
  setupStore();
});

describe("SelectionScreen", () => {
  it("renders photo and text options", () => {
    render(<SelectionScreen />);
    expect(screen.getByText("Foto")).toBeInTheDocument();
    expect(screen.getByText("Lista de texto")).toBeInTheDocument();
  });

  it("calls chooseMode('photo') when photo card is clicked", () => {
    render(<SelectionScreen />);
    fireEvent.click(screen.getByText("Foto"));
    expect(mockChooseMode).toHaveBeenCalledWith("photo");
  });

  it("calls chooseMode('text') when text card is clicked", () => {
    render(<SelectionScreen />);
    fireEvent.click(screen.getByText("Lista de texto"));
    expect(mockChooseMode).toHaveBeenCalledWith("text");
  });
});
