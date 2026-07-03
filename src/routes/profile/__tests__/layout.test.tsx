/** @jest-environment jsdom */
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { ProfileLayout } from "../layout";

jest.mock("@/stores/useProfileStore", () => ({
  useProfileStore: jest.fn(),
}));

import { useProfileStore } from "@/stores/useProfileStore";

const mockUseProfileStore = useProfileStore as unknown as jest.Mock;

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/profile" element={<ProfileLayout />}>
          <Route index element={<div>Configuración view</div>} />
          <Route path="plan" element={<div>Plan view</div>} />
          <Route path="progress" element={<div>Progreso view</div>} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
}

describe("ProfileLayout", () => {
  beforeEach(() => {
    mockUseProfileStore.mockReset();
    mockUseProfileStore.mockReturnValue({
      profile: { id: "p1" },
      hasProfile: true,
      load: jest.fn().mockResolvedValue(undefined),
    });
  });

  it("renders the Configuración child at /profile (index route)", () => {
    renderAt("/profile");
    expect(screen.getByText("Configuración view")).toBeInTheDocument();
  });

  it("renders the Plan child at /profile/plan", () => {
    renderAt("/profile/plan");
    expect(screen.getByText("Plan view")).toBeInTheDocument();
  });

  it("renders the Progreso child at /profile/progress", () => {
    renderAt("/profile/progress");
    expect(screen.getByText("Progreso view")).toBeInTheDocument();
  });

  it("marks the Progreso tab active on /profile/progress and others inactive", () => {
    renderAt("/profile/progress");

    const progresoTab = screen.getByText("Progreso");
    const configTab = screen.getByText("Configuración");
    const planTab = screen.getByText("Plan");

    expect(progresoTab).toHaveClass("border-accent", "text-accent");
    expect(configTab).toHaveClass("border-transparent", "text-gray-400");
    expect(planTab).toHaveClass("border-transparent", "text-gray-400");
  });
});
