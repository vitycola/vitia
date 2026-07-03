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

describe("PlanRoute", () => {
  beforeEach(() => {
    mockUseProfileStore.mockReset();
    mockUseProfileStore.mockReturnValue({
      profile: baseProfile,
      recalcFromProfile: jest.fn().mockResolvedValue(undefined),
    });
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

  it("renders an inert 'Configurar plan personalizado' stub button", () => {
    const store = {
      profile: baseProfile,
      recalcFromProfile: jest.fn().mockResolvedValue(undefined),
      overrideGoals: jest.fn(),
    };
    mockUseProfileStore.mockReturnValue(store);

    render(<PlanRoute />);

    const stub = screen.getByRole("button", { name: /configurar plan personalizado/i });
    expect(stub).toBeDisabled();

    fireEvent.click(stub);

    expect(store.overrideGoals).not.toHaveBeenCalled();
  });
});
