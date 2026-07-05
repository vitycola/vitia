/** @jest-environment jsdom */
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

const mockNavigate = jest.fn();
jest.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
}));

import { ModeSelectRoute } from "../ModeSelect";

describe("ModeSelectRoute", () => {
  beforeEach(() => {
    mockNavigate.mockReset();
  });

  it("renders both mode options in castellano de España", () => {
    render(<ModeSelectRoute />);
    expect(screen.getByText("Manual")).toBeInTheDocument();
    expect(screen.getByText("Basado en ingredientes")).toBeInTheDocument();
  });

  it("tapping 'Manual' navigates to /create-food/manual", () => {
    render(<ModeSelectRoute />);
    fireEvent.click(screen.getByText("Manual"));
    expect(mockNavigate).toHaveBeenCalledWith("/create-food/manual");
  });

  it("tapping 'Basado en ingredientes' navigates to /create-food/ingredients", () => {
    render(<ModeSelectRoute />);
    fireEvent.click(screen.getByText("Basado en ingredientes"));
    expect(mockNavigate).toHaveBeenCalledWith("/create-food/ingredients");
  });
});
