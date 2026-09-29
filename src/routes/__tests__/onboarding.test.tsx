/** @jest-environment jsdom */
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { MemoryRouter } from "react-router-dom";
import { OnboardingRoute } from "../onboarding";

jest.mock("@/stores/useProfileStore", () => ({
  useProfileStore: jest.fn(() => ({ saveProfile: jest.fn() })),
}));

jest.mock("@/src/lib/supabase", () => ({
  isSyncEnabled: jest.fn(() => false),
  getSupabaseClient: jest.fn(),
}));

jest.mock("@/src/stores/useAuthStore", () => ({
  useAuthStore: jest.fn(() => ({ userId: null })),
}));

describe("OnboardingRoute", () => {
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
