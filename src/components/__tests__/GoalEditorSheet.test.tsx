/** @jest-environment jsdom */
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { GoalEditorSheet } from "../GoalEditorSheet";

const initial = {
  calorieGoal: 2000,
  proteinGoalG: 150,
  carbsGoalG: 200,
  fatGoalG: 70,
};

describe("GoalEditorSheet", () => {
  it("renders a dialog seeded with the initial values", () => {
    render(<GoalEditorSheet initial={initial} onSave={jest.fn()} onClose={jest.fn()} />);

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Editar objetivos")).toBeInTheDocument();
    expect(screen.getByLabelText(/Calorías/)).toHaveValue(2000);
    expect(screen.getByLabelText(/Proteínas/)).toHaveValue(150);
    expect(screen.getByLabelText(/Carbohidratos/)).toHaveValue(200);
    expect(screen.getByLabelText(/Grasas/)).toHaveValue(70);
  });

  it("calls onSave with coerced numbers on valid submit", async () => {
    const onSave = jest.fn();
    render(<GoalEditorSheet initial={initial} onSave={onSave} onClose={jest.fn()} />);

    fireEvent.change(screen.getByLabelText(/Calorías/), { target: { value: "2200" } });
    fireEvent.change(screen.getByLabelText(/Proteínas/), { target: { value: "180" } });
    fireEvent.change(screen.getByLabelText(/Carbohidratos/), { target: { value: "220" } });
    fireEvent.change(screen.getByLabelText(/Grasas/), { target: { value: "80" } });
    fireEvent.click(screen.getByText("Guardar"));

    await screen.findByText("Guardar");
    expect(onSave).toHaveBeenCalledWith({
      calorieGoal: 2200,
      proteinGoalG: 180,
      carbsGoalG: 220,
      fatGoalG: 80,
    });
  });

  it("blocks submit and shows a Spanish error when a value is negative", async () => {
    const onSave = jest.fn();
    render(<GoalEditorSheet initial={initial} onSave={onSave} onClose={jest.fn()} />);

    fireEvent.change(screen.getByLabelText(/Calorías/), { target: { value: "-5" } });
    fireEvent.click(screen.getByText("Guardar"));

    expect(await screen.findByText("No puede ser negativo")).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });

  it("blocks submit when a value exceeds the upper bound", async () => {
    const onSave = jest.fn();
    render(<GoalEditorSheet initial={initial} onSave={onSave} onClose={jest.fn()} />);

    fireEvent.change(screen.getByLabelText(/Calorías/), { target: { value: "99999" } });
    fireEvent.click(screen.getByText("Guardar"));

    expect(await screen.findByText("Máximo 10000 kcal")).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });

  it("calls onClose, not onSave, when Cancelar is clicked", () => {
    const onSave = jest.fn();
    const onClose = jest.fn();
    render(<GoalEditorSheet initial={initial} onSave={onSave} onClose={onClose} />);

    fireEvent.click(screen.getByText("Cancelar"));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onSave).not.toHaveBeenCalled();
  });
});
