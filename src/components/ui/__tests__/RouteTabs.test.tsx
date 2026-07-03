/** @jest-environment jsdom */
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { MemoryRouter } from "react-router-dom";
import { RouteTabs } from "../RouteTabs";

const items = [
  { to: "/profile", label: "Configuración", end: true },
  { to: "/profile/plan", label: "Plan" },
  { to: "/profile/progress", label: "Progreso" },
];

describe("RouteTabs", () => {
  it("marks the tab matching the current route as active", () => {
    render(
      <MemoryRouter initialEntries={["/profile/progress"]}>
        <RouteTabs items={items} />
      </MemoryRouter>
    );

    const active = screen.getByText("Progreso");
    const inactive1 = screen.getByText("Configuración");
    const inactive2 = screen.getByText("Plan");

    expect(active).toHaveClass("border-accent", "text-accent");
    expect(inactive1).toHaveClass("border-transparent", "text-gray-400");
    expect(inactive2).toHaveClass("border-transparent", "text-gray-400");
  });

  it("marks the index tab active only on exact match when end=true", () => {
    render(
      <MemoryRouter initialEntries={["/profile"]}>
        <RouteTabs items={items} />
      </MemoryRouter>
    );

    expect(screen.getByText("Configuración")).toHaveClass("border-accent", "text-accent");
    expect(screen.getByText("Plan")).toHaveClass("border-transparent", "text-gray-400");
  });
});
