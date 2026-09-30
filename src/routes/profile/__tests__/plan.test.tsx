/** @jest-environment jsdom */
import { computeBMR, computeTDEE, deriveCalorieGoal, deriveMacros } from "@/lib/nutrition";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import "@testing-library/jest-dom";
import { PlanRoute } from "../plan";

jest.mock("@/stores/useProfileStore", () => ({
  useProfileStore: jest.fn(),
}));

import { useProfileStore } from "@/stores/useProfileStore";

const mockUseProfileStore = useProfileStore as unknown as jest.Mock;

const baseProfile = {
  id: "p1",
  age: 30,
  heightCm: 175,
  weightKg: 75,
  sex: "male",
  activityLevel: "moderately_active",
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
    saveProfile: jest.fn().mockResolvedValue(undefined),
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

  describe("recalculate feedback", () => {
    const computed = deriveCalorieGoal(
      computeTDEE(computeBMR(baseProfile as never), baseProfile.activityLevel as never),
      baseProfile.goal as never
    );

    it("reports the kcal change when goals were out of date", async () => {
      render(<PlanRoute />);

      fireEvent.click(screen.getByRole("button", { name: /recalcular objetivos/i }));

      expect(
        await screen.findByText(`Objetivos actualizados: 1800 → ${computed} kcal`)
      ).toBeInTheDocument();
    });

    it("clears the recalc message when a goal change is confirmed or a goal sheet opens", async () => {
      render(<PlanRoute />);

      fireEvent.click(screen.getByRole("button", { name: /recalcular objetivos/i }));
      await screen.findByText(/Objetivos actualizados/);

      fireEvent.click(screen.getByRole("button", { name: /mantener peso/i }));
      expect(screen.queryByText(/Objetivos actualizados/)).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      expect(screen.getByRole("status")).toHaveTextContent("Objetivo actualizado");
      expect(screen.queryByText(/Objetivos actualizados/)).not.toBeInTheDocument();
    });

    it("says goals are already up to date when nothing changes", async () => {
      mockUseProfileStore.mockReturnValue(
        makeStore({ profile: { ...baseProfile, calorieGoal: computed } })
      );
      render(<PlanRoute />);

      fireEvent.click(screen.getByRole("button", { name: /recalcular objetivos/i }));

      expect(await screen.findByText("Tus objetivos ya están al día")).toBeInTheDocument();
    });
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
  describe("interactive goal selector", () => {
    const profileInput = {
      age: 30,
      heightCm: 175,
      weightKg: 75,
      sex: "male",
      activityLevel: "moderately_active",
    } as const;

    function expected(goal: "lose_weight" | "maintain" | "gain_muscle") {
      const tdee = computeTDEE(computeBMR(profileInput), profileInput.activityLevel);
      const kcal = deriveCalorieGoal(tdee, goal);
      return { kcal, ...deriveMacros(kcal) };
    }

    it("renders the goal chips as buttons with the current one pressed", () => {
      render(<PlanRoute />);

      const group = screen.getByRole("group", { name: /objetivo actual/i });
      expect(within(group).getAllByRole("button")).toHaveLength(3);
      expect(screen.getByRole("button", { name: /perder peso/i })).toHaveAttribute(
        "aria-pressed",
        "true"
      );
      expect(screen.getByRole("button", { name: /mantener peso/i })).toHaveAttribute(
        "aria-pressed",
        "false"
      );
      expect(screen.getByRole("button", { name: /ganar músculo/i })).toHaveAttribute(
        "aria-pressed",
        "false"
      );
    });

    it("does nothing when the current goal is clicked", () => {
      render(<PlanRoute />);

      fireEvent.click(screen.getByRole("button", { name: /perder peso/i }));

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("opens a preview with current vs new computed targets for a different goal", () => {
      render(<PlanRoute />);

      fireEvent.click(screen.getByRole("button", { name: /ganar músculo/i }));

      const dialog = screen.getByRole("dialog", { name: /cambiar objetivo/i });
      const next = expected("gain_muscle");
      expect(within(dialog).getByText(`${Math.round(next.kcal)} kcal`)).toBeInTheDocument();
      expect(within(dialog).getByText(`${Math.round(next.proteinG)} g`)).toBeInTheDocument();
      expect(within(dialog).getByText(`${Math.round(next.carbsG)} g`)).toBeInTheDocument();
      expect(within(dialog).getByText(`${Math.round(next.fatG)} g`)).toBeInTheDocument();
      // current values come from the persisted profile
      expect(within(dialog).getByText("1800 kcal")).toBeInTheDocument();
    });

    it("previews known literal values for a fixed profile (formula regression guard)", () => {
      // Literals computed once from lib/nutrition for the base profile
      // (30y, 175cm, 75kg, male, moderately_active). Do not derive them from the lib.
      render(<PlanRoute />);

      fireEvent.click(screen.getByRole("button", { name: /mantener peso/i }));

      const dialog = screen.getByRole("dialog", { name: /cambiar objetivo/i });
      expect(within(dialog).getByText("2633 kcal")).toBeInTheDocument();
      expect(within(dialog).getByText("197 g")).toBeInTheDocument();
      expect(within(dialog).getByText("263 g")).toBeInTheDocument();
      expect(within(dialog).getByText("88 g")).toBeInTheDocument();
    });

    it("shows the manual-goals warning only when useManualGoals is true", () => {
      const { unmount } = render(<PlanRoute />);
      fireEvent.click(screen.getByRole("button", { name: /mantener peso/i }));
      expect(screen.queryByText(/se reemplazarán por los calculados/i)).not.toBeInTheDocument();
      unmount();

      mockUseProfileStore.mockReturnValue(
        makeStore({ profile: { ...baseProfile, useManualGoals: true } })
      );
      render(<PlanRoute />);
      fireEvent.click(screen.getByRole("button", { name: /mantener peso/i }));
      expect(screen.getByText(/se reemplazarán por los calculados/i)).toBeInTheDocument();
    });

    it("saves the profile with the new goal on confirm, closes and shows feedback", async () => {
      const store = makeStore();
      mockUseProfileStore.mockReturnValue(store);
      render(<PlanRoute />);

      fireEvent.click(screen.getByRole("button", { name: /mantener peso/i }));
      fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));

      await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
      expect(store.saveProfile).toHaveBeenCalledWith({ ...profileInput, goal: "maintain" });
      expect(screen.getByRole("status")).toHaveTextContent("Objetivo actualizado");
    });

    it("does not save when cancelled", () => {
      const store = makeStore();
      mockUseProfileStore.mockReturnValue(store);
      render(<PlanRoute />);

      fireEvent.click(screen.getByRole("button", { name: /mantener peso/i }));
      fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(store.saveProfile).not.toHaveBeenCalled();
    });

    it("keeps the sheet open and shows an error when saving fails", async () => {
      const store = makeStore({ saveProfile: jest.fn().mockRejectedValue(new Error("boom")) });
      mockUseProfileStore.mockReturnValue(store);
      render(<PlanRoute />);

      fireEvent.click(screen.getByRole("button", { name: /mantener peso/i }));
      fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));

      expect(await screen.findByRole("alert")).toHaveTextContent(/no se pudo actualizar/i);
      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });
  });
});
