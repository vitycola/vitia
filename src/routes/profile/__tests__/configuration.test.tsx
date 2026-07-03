/** @jest-environment jsdom */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { MemoryRouter } from "react-router-dom";
import { ConfigurationRoute } from "../configuration";

jest.mock("@/stores/useProfileStore", () => ({
  useProfileStore: jest.fn(),
}));

jest.mock("@/src/lib/supabase", () => ({
  isSyncEnabled: jest.fn(() => false),
}));

jest.mock("@/src/stores/useAuthStore", () => ({
  useAuthStore: jest.fn(() => ({ signOut: jest.fn() })),
}));

import { useProfileStore } from "@/stores/useProfileStore";

const mockUseProfileStore = useProfileStore as unknown as jest.Mock;

const baseProfile = {
  id: "p1",
  age: 30,
  heightCm: 175,
  weightKg: 70,
  sex: "male",
  activityLevel: "moderately_active",
  goal: "lose_weight",
};

function renderRoute(saveProfile = jest.fn().mockResolvedValue(undefined)) {
  mockUseProfileStore.mockReturnValue({
    profile: baseProfile,
    saveProfile,
  });
  render(
    <MemoryRouter>
      <ConfigurationRoute />
    </MemoryRouter>
  );
  return { saveProfile };
}

describe("ConfigurationRoute", () => {
  beforeEach(() => {
    mockUseProfileStore.mockReset();
  });

  it("prefills the form with the current profile values", () => {
    renderRoute();

    expect(screen.getByLabelText(/edad/i)).toHaveValue(30);
    expect(screen.getByLabelText(/altura/i)).toHaveValue(175);
    expect(screen.getByLabelText(/peso/i)).toHaveValue(70);
    expect(screen.getByLabelText(/sexo/i)).toHaveValue("male");
    expect(screen.getByLabelText(/actividad/i)).toHaveValue("moderately_active");
  });

  it("calls saveProfile with mapped values on a valid submit, preserving the current goal", async () => {
    const { saveProfile } = renderRoute();

    fireEvent.change(screen.getByLabelText(/peso/i), { target: { value: "75" } });
    fireEvent.click(screen.getByRole("button", { name: /guardar cambios/i }));

    await waitFor(() => {
      expect(saveProfile).toHaveBeenCalledWith({
        age: 30,
        heightCm: 175,
        weightKg: 75,
        sex: "male",
        activityLevel: "moderately_active",
        goal: "lose_weight",
      });
    });
  });

  it("blocks submission and does not call saveProfile when a field is invalid", async () => {
    const { saveProfile } = renderRoute();

    fireEvent.change(screen.getByLabelText(/edad/i), { target: { value: "5" } });
    fireEvent.click(screen.getByRole("button", { name: /guardar cambios/i }));

    await waitFor(() => {
      expect(screen.getByText(/mínimo 10 años/i)).toBeInTheDocument();
    });
    expect(saveProfile).not.toHaveBeenCalled();
  });

  it("renders non-interactive body-measurement placeholder rows that persist nothing", () => {
    renderRoute();

    const cuello = screen.getByText("Cuello");
    expect(cuello.closest("button")).toBeNull();

    for (const label of ["Cuello", "Pecho", "Brazo", "Cintura", "Cadera", "Muslo"]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
  });
});
