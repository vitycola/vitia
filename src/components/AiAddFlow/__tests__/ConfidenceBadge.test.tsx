/** @jest-environment jsdom */
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { ConfidenceBadge } from "../ConfidenceBadge";

describe("ConfidenceBadge", () => {
  it("renders 'Alta' label for high confidence", () => {
    render(<ConfidenceBadge confidence="high" />);
    expect(screen.getByText("Alta")).toBeInTheDocument();
  });

  it("renders 'Media' label for medium confidence", () => {
    render(<ConfidenceBadge confidence="medium" />);
    expect(screen.getByText("Media")).toBeInTheDocument();
  });

  it("renders 'Baja' label for low confidence", () => {
    render(<ConfidenceBadge confidence="low" />);
    expect(screen.getByText("Baja")).toBeInTheDocument();
  });

  it("does not render an edit affordance for low confidence", () => {
    render(<ConfidenceBadge confidence="low" />);
    expect(screen.getByText("Baja")).toBeInTheDocument();
    expect(screen.queryByText(/editar/i)).not.toBeInTheDocument();
  });

  it("applies green color for high confidence", () => {
    render(<ConfidenceBadge confidence="high" />);
    const badge = screen.getByText("Alta");
    expect(badge).toHaveStyle({ color: "#16a34a" });
  });

  it("applies amber color for medium confidence", () => {
    render(<ConfidenceBadge confidence="medium" />);
    const badge = screen.getByText("Media");
    expect(badge).toHaveStyle({ color: "#F5A623" });
  });

  it("applies red color for low confidence", () => {
    render(<ConfidenceBadge confidence="low" />);
    const badge = screen.getByText("Baja");
    expect(badge).toHaveStyle({ color: "#FF3B30" });
  });
});
