import { getMacroBarColor } from "../macroColor";
import { Colors } from "../tokens";

describe("getMacroBarColor", () => {
  it("returns macroAmber at 79% (below lower bound)", () => {
    expect(getMacroBarColor(79, 100)).toBe(Colors.macroAmber);
  });

  it("returns macroOntargetGreen at 80% (lower bound inclusive)", () => {
    expect(getMacroBarColor(80, 100)).toBe(Colors.macroOntargetGreen);
  });

  it("returns macroOntargetGreen at 110% (upper bound inclusive)", () => {
    expect(getMacroBarColor(110, 100)).toBe(Colors.macroOntargetGreen);
  });

  it("returns macroAmber at 111% (above upper bound)", () => {
    expect(getMacroBarColor(111, 100)).toBe(Colors.macroAmber);
  });

  it("returns macroAmber when goal is 0 (divide-by-zero guard)", () => {
    expect(getMacroBarColor(0, 0)).toBe(Colors.macroAmber);
  });
});
