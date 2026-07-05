/** @jest-environment jsdom */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

const mockNavigate = jest.fn();
jest.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
}));

const mockCreateComposite = jest.fn();
jest.mock("@/db/repos/foods", () => ({
  createComposite: (...args: unknown[]) => mockCreateComposite(...args),
}));

jest.mock("@/lib/id", () => ({ generateId: () => "generated-id" }));

import { ManualFormRoute } from "../ManualForm";

describe("ManualFormRoute", () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockCreateComposite.mockReset();
    mockCreateComposite.mockResolvedValue({ id: "generated-id" });
  });

  function fillValidForm() {
    fireEvent.change(screen.getByLabelText(/nombre del alimento/i), {
      target: { value: "Tortilla casera" },
    });
    fireEvent.click(screen.getByText("Huevos"));
    fireEvent.change(screen.getByLabelText(/peso de la porción/i), {
      target: { value: "120" },
    });
    fireEvent.change(screen.getByLabelText(/calorías/i), { target: { value: "150" } });
    fireEvent.change(screen.getByLabelText(/proteínas/i), { target: { value: "10" } });
    fireEvent.change(screen.getByLabelText(/carbohidratos/i), { target: { value: "5" } });
    fireEvent.change(screen.getByLabelText(/grasas/i), { target: { value: "8" } });
  }

  it("renders category chips from lib/foodCategories", () => {
    render(<ManualFormRoute />);
    expect(screen.getByText("Huevos")).toBeInTheDocument();
    expect(screen.getByText("Vegetales")).toBeInTheDocument();
  });

  it("valid save calls createComposite with entered values", async () => {
    render(<ManualFormRoute />);
    fillValidForm();
    fireEvent.click(screen.getByRole("button", { name: /guardar/i }));

    await waitFor(() => expect(mockCreateComposite).toHaveBeenCalledTimes(1));
    const [food, ingredients] = mockCreateComposite.mock.calls[0];
    expect(food).toMatchObject({
      name: "Tortilla casera",
      category: "huevos",
      servingSizeG: 120,
      caloriesPer100g: 150,
      proteinPer100g: 10,
      carbsPer100g: 5,
      fatPer100g: 8,
      source: "custom",
    });
    expect(ingredients).toEqual([]);
  });

  it("blocks save when name is empty", async () => {
    render(<ManualFormRoute />);
    fillValidForm();
    fireEvent.change(screen.getByLabelText(/nombre del alimento/i), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: /guardar/i }));

    await waitFor(() => expect(screen.getByText(/introduce el nombre/i)).toBeInTheDocument());
    expect(mockCreateComposite).not.toHaveBeenCalled();
  });

  it("blocks save when a macro is negative", async () => {
    render(<ManualFormRoute />);
    fillValidForm();
    fireEvent.change(screen.getByLabelText(/proteínas/i), { target: { value: "-5" } });
    fireEvent.click(screen.getByRole("button", { name: /guardar/i }));

    await waitFor(() => expect(mockCreateComposite).not.toHaveBeenCalled());
  });

  it("blocks save when portion weight is zero", async () => {
    render(<ManualFormRoute />);
    fillValidForm();
    fireEvent.change(screen.getByLabelText(/peso de la porción/i), { target: { value: "0" } });
    fireEvent.click(screen.getByRole("button", { name: /guardar/i }));

    await waitFor(() => expect(mockCreateComposite).not.toHaveBeenCalled());
  });

  it("blocks save when no category is selected", async () => {
    render(<ManualFormRoute />);
    fireEvent.change(screen.getByLabelText(/nombre del alimento/i), {
      target: { value: "Tortilla casera" },
    });
    fireEvent.change(screen.getByLabelText(/peso de la porción/i), {
      target: { value: "120" },
    });
    fireEvent.change(screen.getByLabelText(/calorías/i), { target: { value: "150" } });
    fireEvent.change(screen.getByLabelText(/proteínas/i), { target: { value: "10" } });
    fireEvent.change(screen.getByLabelText(/carbohidratos/i), { target: { value: "5" } });
    fireEvent.change(screen.getByLabelText(/grasas/i), { target: { value: "8" } });
    fireEvent.click(screen.getByRole("button", { name: /guardar/i }));

    await waitFor(() => expect(screen.getByText(/selecciona una categoría/i)).toBeInTheDocument());
    expect(mockCreateComposite).not.toHaveBeenCalled();
  });
});
