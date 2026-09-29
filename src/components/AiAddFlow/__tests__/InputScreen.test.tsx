/** @jest-environment jsdom */
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

jest.mock("@/stores/useAiAddFlowStore", () => ({
  useAiAddFlowStore: jest.fn(),
}));

import { useAiAddFlowStore } from "@/stores/useAiAddFlowStore";
import { InputScreen } from "../InputScreen";

const mockSubmitPhoto = jest.fn();
const mockSubmitText = jest.fn();

function setupStore(overrides: Record<string, unknown> = {}) {
  (useAiAddFlowStore as unknown as jest.Mock).mockReturnValue({
    inputMode: "photo",
    status: "idle",
    error: null,
    submitPhoto: mockSubmitPhoto,
    submitText: mockSubmitText,
    ...overrides,
  });
}

beforeEach(() => {
  mockSubmitPhoto.mockReset();
  mockSubmitText.mockReset();
  Object.defineProperty(navigator, "onLine", { value: true, configurable: true });
});

describe("InputScreen — photo mode", () => {
  it("does not show submit CTA when no file is selected", () => {
    setupStore({ inputMode: "photo" });
    render(<InputScreen />);
    expect(screen.queryByRole("button", { name: /analizar con ia/i })).not.toBeInTheDocument();
  });

  it("shows submit CTA after a file is selected", () => {
    setupStore({ inputMode: "photo" });
    render(<InputScreen />);
    const input = screen.getByTestId("photo-file-input");
    const file = new File(["data"], "photo.jpg", { type: "image/jpeg" });
    fireEvent.change(input, { target: { files: [file] } });
    expect(screen.getByRole("button", { name: /analizar con ia/i })).toBeInTheDocument();
  });
});

describe("InputScreen — text mode", () => {
  it("CTA is disabled when textarea is empty", () => {
    setupStore({ inputMode: "text" });
    render(<InputScreen />);
    expect(screen.getByRole("button", { name: /analizar con ia/i })).toBeDisabled();
  });

  it("CTA is enabled when any meal textarea has text", () => {
    setupStore({ inputMode: "text" });
    render(<InputScreen />);
    // There are 4 textareas (one per meal); type in the first one
    fireEvent.change(screen.getAllByRole("textbox")[0], { target: { value: "100g de arroz" } });
    expect(screen.getByRole("button", { name: /analizar con ia/i })).not.toBeDisabled();
  });
});

describe("InputScreen — per-meal submit", () => {
  it("submits one entry per non-empty meal, in canonical order", () => {
    setupStore({ inputMode: "text" });
    render(<InputScreen />);
    const boxes = screen.getAllByRole("textbox"); // breakfast, lunch, dinner, snack
    fireEvent.change(boxes[2], { target: { value: "  sopa  " } });
    fireEvent.change(boxes[0], { target: { value: "tostada" } });
    fireEvent.click(screen.getByRole("button", { name: /analizar con ia/i }));
    expect(mockSubmitText).toHaveBeenCalledTimes(1);
    expect(mockSubmitText).toHaveBeenCalledWith([
      { mealType: "breakfast", text: "tostada" },
      { mealType: "dinner", text: "sopa" },
    ]);
  });

  it("does not include whitespace-only meals and keeps CTA disabled without entries", () => {
    setupStore({ inputMode: "text" });
    render(<InputScreen />);
    fireEvent.change(screen.getAllByRole("textbox")[1], { target: { value: "   " } });
    expect(screen.getByRole("button", { name: /analizar con ia/i })).toBeDisabled();
  });

  it("labels the fourth section Merienda, not Snack", () => {
    setupStore({ inputMode: "text" });
    render(<InputScreen />);
    expect(screen.getByText("Merienda")).toBeInTheDocument();
    expect(screen.queryByText("Snack")).not.toBeInTheDocument();
  });

  it("text mode has no single-meal selector buttons", () => {
    setupStore({ inputMode: "text" });
    render(<InputScreen />);
    expect(screen.queryByRole("button", { name: "Desayuno" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("textbox")).toHaveLength(4);
  });
});

describe("InputScreen — error state", () => {
  it("shows inline error message when status=error", () => {
    setupStore({
      inputMode: "text",
      status: "error",
      error: "No se pudo conectar con el asistente IA.",
    });
    render(<InputScreen />);
    expect(screen.getByText("No se pudo conectar con el asistente IA.")).toBeInTheDocument();
  });
});

describe("InputScreen — offline", () => {
  it("blocks submit with inline message when navigator.onLine is false (text mode)", () => {
    Object.defineProperty(navigator, "onLine", { value: false, configurable: true });
    setupStore({ inputMode: "text" });
    render(<InputScreen />);
    fireEvent.change(screen.getAllByRole("textbox")[0], { target: { value: "algo" } });
    fireEvent.click(screen.getByRole("button", { name: /analizar con ia/i }));
    expect(mockSubmitText).not.toHaveBeenCalled();
    expect(screen.getByText(/requiere conexión/i)).toBeInTheDocument();
  });
});
