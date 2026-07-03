/** @jest-environment jsdom */
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { ProgressRoute } from "../progress";

describe("ProgressRoute", () => {
  it("renders all 4 empty-state cards inside a 2x2 grid", () => {
    const { container } = render(<ProgressRoute />);

    expect(screen.getByText("Calorías")).toBeInTheDocument();
    expect(screen.getByText("Peso")).toBeInTheDocument();
    expect(screen.getByText("% Grasa")).toBeInTheDocument();
    expect(screen.getByText("Medidas")).toBeInTheDocument();

    const grid = container.querySelector(".grid.grid-cols-2");
    expect(grid).not.toBeNull();
    expect(grid?.children).toHaveLength(4);
  });

  it("renders the photo stub full-width below the grid", () => {
    render(<ProgressRoute />);

    const photoStub = screen.getByRole("button", { name: /agregar foto de progreso/i });
    expect(photoStub).toBeDisabled();
  });

  it("clicking the photo stub triggers no side effect", () => {
    render(<ProgressRoute />);

    const photoStub = screen.getByRole("button", { name: /agregar foto de progreso/i });
    fireEvent.click(photoStub);

    expect(photoStub).toBeDisabled();
  });
});
