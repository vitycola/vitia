/** @jest-environment jsdom */
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { CalorieCard } from "../CalorieCard";

const baseProps = {
  consumed: 1200,
  goal: 2000,
  proteinG: 80,
  proteinGoalG: 150,
  carbsG: 100,
  carbsGoalG: 200,
  fatG: 40,
  fatGoalG: 70,
};

describe("CalorieCard interaction", () => {
  it("fires onEditGoals when the pencil button is clicked", () => {
    const onEditGoals = jest.fn();
    render(<CalorieCard {...baseProps} onEditGoals={onEditGoals} />);

    fireEvent.click(screen.getByLabelText("Edit calorie goal"));

    expect(onEditGoals).toHaveBeenCalledTimes(1);
  });

  it("is inert when onEditGoals is not provided", () => {
    render(<CalorieCard {...baseProps} />);

    expect(() => fireEvent.click(screen.getByLabelText("Edit calorie goal"))).not.toThrow();
  });
});
