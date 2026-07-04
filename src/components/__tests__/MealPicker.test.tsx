/** @jest-environment jsdom */
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { MealPicker } from "../MealPicker";

describe("MealPicker", () => {
  it("pre-checks the active meal type when provided", () => {
    render(<MealPicker activeMealType="dinner" onConfirm={jest.fn()} onCancel={jest.fn()} />);

    expect(screen.getByLabelText("Cena")).toBeChecked();
    expect(screen.getByLabelText("Desayuno")).not.toBeChecked();
    expect(screen.getByLabelText("Almuerzo")).not.toBeChecked();
    expect(screen.getByLabelText("Merienda")).not.toBeChecked();
  });

  it("renders all 4 meal options unchecked when no active meal type is given", () => {
    render(<MealPicker onConfirm={jest.fn()} onCancel={jest.fn()} />);

    for (const label of ["Desayuno", "Almuerzo", "Cena", "Merienda"]) {
      expect(screen.getByLabelText(label)).not.toBeChecked();
    }
  });

  it("allows checking/unchecking any option regardless of the pre-checked one", () => {
    render(<MealPicker activeMealType="lunch" onConfirm={jest.fn()} onCancel={jest.fn()} />);

    fireEvent.click(screen.getByLabelText("Cena"));
    fireEvent.click(screen.getByLabelText("Almuerzo")); // uncheck pre-checked

    expect(screen.getByLabelText("Cena")).toBeChecked();
    expect(screen.getByLabelText("Almuerzo")).not.toBeChecked();
  });

  it("confirm calls onConfirm with the selected meal types", () => {
    const onConfirm = jest.fn();
    render(<MealPicker activeMealType="lunch" onConfirm={onConfirm} onCancel={jest.fn()} />);

    fireEvent.click(screen.getByLabelText("Cena"));
    fireEvent.click(screen.getByText("Confirmar"));

    expect(onConfirm).toHaveBeenCalledWith(expect.arrayContaining(["lunch", "dinner"]));
    expect(onConfirm.mock.calls[0][0]).toHaveLength(2);
  });

  it("confirming with zero selections calls onConfirm with an empty array", () => {
    const onConfirm = jest.fn();
    render(<MealPicker activeMealType="lunch" onConfirm={onConfirm} onCancel={jest.fn()} />);

    fireEvent.click(screen.getByLabelText("Almuerzo")); // uncheck the only pre-checked option
    fireEvent.click(screen.getByText("Confirmar"));

    expect(onConfirm).toHaveBeenCalledWith([]);
  });

  it("cancel calls onCancel without calling onConfirm", () => {
    const onConfirm = jest.fn();
    const onCancel = jest.fn();
    render(<MealPicker onConfirm={onConfirm} onCancel={onCancel} />);

    fireEvent.click(screen.getByText("Cancelar"));

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
