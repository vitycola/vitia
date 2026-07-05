/** @jest-environment jsdom */
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { PlanRoute } from "../plan";

jest.mock("@/stores/useProfileStore", () => ({
  useProfileStore: jest.fn(),
}));

import { useProfileStore } from "@/stores/useProfileStore";

const mockUseProfileStore = useProfileStore as unknown as jest.Mock;

const baseProfile = {
  id: "p1",
  goal: "lose_weight",
  calorieGoal: 1800,
  proteinGoalG: 120,
  carbsGoalG: 180,
  fatGoalG: 55,
  useManualGoals: false,
};

function makeStore(overrides: Record<string, unknown> = {}) {
  return {
    profile: baseProfile,
    recalcFromProfile: jest.fn().mockResolvedValue(undefined),
    overrideGoals: jest.fn().mockResolvedValue(undefined),
    revertToAutomaticGoals: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe("PlanRoute", () => {
  beforeEach(() => {
    mockUseProfileStore.mockReset();
    mockUseProfileStore.mockReturnValue(makeStore());
  });

  it("renders the current goal and macro targets", () => {
    render(<PlanRoute />);

    expect(screen.getAllByText("Perder peso").length).toBeGreaterThan(0);
    expect(screen.getByText(/1800 kcal/)).toBeInTheDocument();
    expect(screen.getByText(/120 g/)).toBeInTheDocument();
    expect(screen.getByText(/180 g/)).toBeInTheDocument();
    expect(screen.getByText(/55 g/)).toBeInTheDocument();
  });

  it("renders all 3 goal presets", () => {
    render(<PlanRoute />);

    expect(screen.getAllByText("Perder peso").length).toBeGreaterThan(0);
    expect(screen.getByText("Mantener peso")).toBeInTheDocument();
    expect(screen.getByText("Ganar músculo")).toBeInTheDocument();
  });

  it("opens the goal editor when 'Configurar plan personalizado' is clicked", () => {
    render(<PlanRoute />);

    const button = screen.getByRole("button", { name: /configurar plan personalizado/i });
    expect(button).not.toBeDisabled();

    fireEvent.click(button);

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Editar objetivos")).toBeInTheDocument();
  });

  it("calls overrideGoals with the expected shape on save", async () => {
    const store = makeStore();
    mockUseProfileStore.mockReturnValue(store);

    render(<PlanRoute />);

    fireEvent.click(screen.getByRole("button", { name: /configurar plan personalizado/i }));

    fireEvent.change(screen.getByLabelText(/Calorías/), { target: { value: "2200" } });
    fireEvent.change(screen.getByLabelText(/Proteínas/), { target: { value: "180" } });
    fireEvent.change(screen.getByLabelText(/Carbohidratos/), { target: { value: "220" } });
    fireEvent.change(screen.getByLabelText(/Grasas/), { target: { value: "80" } });
    fireEvent.click(screen.getByText("Guardar"));

    await screen.findByText("Guardar", {}, { timeout: 100 }).catch(() => {});

    expect(store.overrideGoals).toHaveBeenCalledWith({
      calorieGoal: 2200,
      proteinGoalG: 180,
      carbsGoalG: 220,
      fatGoalG: 80,
    });
  });

  it("shows 'Recalcular objetivos' and hides 'Volver a objetivos automáticos' when useManualGoals is false", () => {
    mockUseProfileStore.mockReturnValue(
      makeStore({ profile: { ...baseProfile, useManualGoals: false } })
    );

    render(<PlanRoute />);

    expect(screen.getByRole("button", { name: /recalcular objetivos/i })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /volver a objetivos automáticos/i })
    ).not.toBeInTheDocument();
  });

  it("shows 'Volver a objetivos automáticos' and hides 'Recalcular objetivos' when useManualGoals is true", () => {
    mockUseProfileStore.mockReturnValue(
      makeStore({ profile: { ...baseProfile, useManualGoals: true } })
    );

    render(<PlanRoute />);

    expect(
      screen.getByRole("button", { name: /volver a objetivos automáticos/i })
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /recalcular objetivos/i })).not.toBeInTheDocument();
  });

  it("calls revertToAutomaticGoals when 'Volver a objetivos automáticos' is clicked", () => {
    const store = makeStore({ profile: { ...baseProfile, useManualGoals: true } });
    mockUseProfileStore.mockReturnValue(store);

    render(<PlanRoute />);

    fireEvent.click(screen.getByRole("button", { name: /volver a objetivos automáticos/i }));

    expect(store.revertToAutomaticGoals).toHaveBeenCalledTimes(1);
  });
});
