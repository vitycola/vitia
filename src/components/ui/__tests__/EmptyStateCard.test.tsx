/** @jest-environment jsdom */
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { EmptyStateCard } from "../EmptyStateCard";

describe("EmptyStateCard", () => {
  it("renders the title and is square via aspect-square", () => {
    render(<EmptyStateCard title="Calorías" />);

    const title = screen.getByText("Calorías");
    expect(title).toBeInTheDocument();

    const card = title.closest(".aspect-square");
    expect(card).not.toBeNull();
  });

  it("renders the children slot when passed (chart seam)", () => {
    render(
      <EmptyStateCard title="Peso">
        <span>chart placeholder</span>
      </EmptyStateCard>
    );

    expect(screen.getByText("chart placeholder")).toBeInTheDocument();
  });

  it("shows the Próximamente empty state when no children are passed", () => {
    render(<EmptyStateCard title="% Grasa" />);

    expect(screen.getByText(/próximamente/i)).toBeInTheDocument();
  });
});
