/** @jest-environment jsdom */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { MemoryRouter } from "react-router-dom";
import { OnboardingRoute } from "../onboarding";

jest.mock("@/stores/useProfileStore", () => ({
  useProfileStore: jest.fn(() => ({ saveProfile: jest.fn() })),
}));

jest.mock("@/stores/useProgressStore", () => ({
  useProgressStore: { getState: jest.fn() },
}));

jest.mock("@/lib/date", () => ({
  todayISO: () => "2026-03-10",
}));

jest.mock("@/src/lib/supabase", () => ({
  isSyncEnabled: jest.fn(() => false),
  getSupabaseClient: jest.fn(),
}));

jest.mock("@/src/stores/useAuthStore", () => ({
  useAuthStore: jest.fn(() => ({ userId: null })),
}));

import { useProfileStore } from "@/stores/useProfileStore";
import { useProgressStore } from "@/stores/useProgressStore";

describe("OnboardingRoute", () => {
  it("records the initial weight as today's first weigh-in after saving the profile", async () => {
    const saveProfile = jest.fn().mockResolvedValue(undefined);
    const recordWeight = jest.fn().mockResolvedValue(undefined);
    (useProfileStore as unknown as jest.Mock).mockReturnValue({ saveProfile });
    (useProgressStore.getState as jest.Mock).mockReturnValue({ recordWeight });
    render(
      <MemoryRouter>
        <OnboardingRoute />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText(/edad/i), { target: { value: "30" } });
    fireEvent.change(screen.getByLabelText(/altura/i), { target: { value: "175" } });
    fireEvent.change(screen.getByLabelText(/peso/i), { target: { value: "75" } });
    fireEvent.change(screen.getByLabelText(/sexo/i), { target: { value: "male" } });
    fireEvent.change(screen.getByLabelText(/nivel de actividad/i), {
      target: { value: "moderately_active" },
    });
    fireEvent.change(screen.getByLabelText(/objetivo/i), { target: { value: "maintain" } });
    fireEvent.click(screen.getByRole("button", { name: /guardar perfil/i }));

    await waitFor(() => expect(recordWeight).toHaveBeenCalledWith("2026-03-10", 75));
    expect(saveProfile).toHaveBeenCalledTimes(1);
  });

  it("shows Spanish required messages, not raw Zod text, when submitted empty", async () => {
    render(
      <MemoryRouter>
        <OnboardingRoute />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: /guardar perfil/i }));

    expect(await screen.findAllByText("Campo obligatorio")).toHaveLength(3);
    expect(screen.getAllByText("Opción obligatoria")).toHaveLength(3);
    expect(screen.queryByText(/invalid enum value/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/mínimo/i)).not.toBeInTheDocument();
  });
});
