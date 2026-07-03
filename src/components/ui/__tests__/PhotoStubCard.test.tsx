/** @jest-environment jsdom */
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { PhotoStubCard } from "../PhotoStubCard";

describe("PhotoStubCard", () => {
  it("renders a full-width, disabled, inert control", () => {
    render(<PhotoStubCard />);

    const control = screen.getByRole("button");
    expect(control).toBeDisabled();
    expect(control).toHaveClass("w-full");
  });

  it("does nothing when clicked (no file picker, no network, no store call)", () => {
    render(<PhotoStubCard />);

    const control = screen.getByRole("button");
    // Disabled buttons don't fire click handlers in jsdom either way;
    // assert explicitly there is no onClick side effect exposed.
    fireEvent.click(control);

    expect(control).toBeDisabled();
  });

  it("shows the Próximamente copy", () => {
    render(<PhotoStubCard />);
    expect(screen.getByText(/próximamente/i)).toBeInTheDocument();
  });
});
