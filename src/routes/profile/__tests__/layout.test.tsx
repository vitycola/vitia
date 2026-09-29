/** @jest-environment jsdom */
import { act, render, screen } from "@testing-library/react";
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
        <Route path="/onboarding" element={<div>Onboarding view</div>} />
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

  describe("onboarding redirect guard", () => {
    function deferred() {
      let resolve!: () => void;
      const promise = new Promise<void>((res) => {
        resolve = res;
      });
      return { promise, resolve };
    }

    it("does not redirect to /onboarding while load() is still pending", async () => {
      const pending = deferred();
      mockUseProfileStore.mockReturnValue({
        profile: null,
        hasProfile: false,
        load: jest.fn().mockReturnValue(pending.promise),
      });

      renderAt("/profile");

      expect(screen.getByText("Cargando perfil…")).toBeInTheDocument();
      expect(screen.queryByText("Onboarding view")).not.toBeInTheDocument();

      await act(async () => {
        pending.resolve();
      });
    });

    it("redirects to /onboarding once load() settles and there is still no profile", async () => {
      const pending = deferred();
      mockUseProfileStore.mockReturnValue({
        profile: null,
        hasProfile: false,
        load: jest.fn().mockReturnValue(pending.promise),
      });

      renderAt("/profile");
      expect(screen.queryByText("Onboarding view")).not.toBeInTheDocument();

      await act(async () => {
        pending.resolve();
      });

      expect(await screen.findByText("Onboarding view")).toBeInTheDocument();
    });

    it("renders the child without redirecting when load() yields a profile", async () => {
      const pending = deferred();
      mockUseProfileStore.mockReturnValue({
        profile: null,
        hasProfile: false,
        load: jest.fn().mockReturnValue(pending.promise),
      });

      const view = render(
        <MemoryRouter initialEntries={["/profile"]}>
          <Routes>
            <Route path="/profile" element={<ProfileLayout />}>
              <Route index element={<div>Configuración view</div>} />
            </Route>
            <Route path="/onboarding" element={<div>Onboarding view</div>} />
          </Routes>
        </MemoryRouter>
      );

      // The store updates before the load promise settles, as in the real store.
      mockUseProfileStore.mockReturnValue({
        profile: { id: "p1" },
        hasProfile: true,
        load: jest.fn().mockResolvedValue(undefined),
      });
      view.rerender(
        <MemoryRouter initialEntries={["/profile"]}>
          <Routes>
            <Route path="/profile" element={<ProfileLayout />}>
              <Route index element={<div>Configuración view</div>} />
            </Route>
            <Route path="/onboarding" element={<div>Onboarding view</div>} />
          </Routes>
        </MemoryRouter>
      );

      await act(async () => {
        pending.resolve();
      });

      expect(screen.getByText("Configuración view")).toBeInTheDocument();
      expect(screen.queryByText("Onboarding view")).not.toBeInTheDocument();
    });
  });
});
