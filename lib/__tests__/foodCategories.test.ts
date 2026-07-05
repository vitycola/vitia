import { FOOD_CATEGORIES, categoryIcon } from "../foodCategories";

describe("FOOD_CATEGORIES", () => {
  it("has all 14 spec categories", () => {
    const expectedKeys = [
      "vegetales",
      "frutas",
      "cereales_y_granos",
      "legumbres",
      "lacteos",
      "huevos",
      "carnes",
      "pescados_y_mariscos",
      "fiambres_y_embutidos",
      "frutos_secos",
      "bebidas",
      "dulces_y_snacks",
      "condimentos_y_salsas",
      "otros",
    ];
    expect(Object.keys(FOOD_CATEGORIES).sort()).toEqual(expectedKeys.sort());
  });

  it("every category has a non-empty label and icon", () => {
    for (const key of Object.keys(FOOD_CATEGORIES)) {
      const entry = FOOD_CATEGORIES[key as keyof typeof FOOD_CATEGORIES];
      expect(entry.label.length).toBeGreaterThan(0);
      expect(entry.icon.length).toBeGreaterThan(0);
    }
  });
});

describe("categoryIcon", () => {
  it("returns the correct icon for a known key", () => {
    expect(categoryIcon("lacteos")).toBe(FOOD_CATEGORIES.lacteos.icon);
  });

  it("returns a distinct icon per category (spot check two categories differ)", () => {
    expect(categoryIcon("lacteos")).not.toBe(categoryIcon("frutas"));
  });

  it("returns the fallback icon for null", () => {
    expect(categoryIcon(null)).toBe("🍽️");
  });

  it("returns the fallback icon for an unknown key", () => {
    expect(categoryIcon("not-a-real-category")).toBe("🍽️");
  });
});
