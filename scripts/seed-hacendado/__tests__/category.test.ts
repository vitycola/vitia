import { resolveCategory } from "../category";

describe("resolveCategory", () => {
  it("maps staples", () => {
    expect(resolveCategory(["en:pastas"])).toBe("cereales_y_granos");
    expect(resolveCategory(["en:legumes", "en:canned-legumes"])).toBe("legumbres");
    expect(resolveCategory(["en:precooked-rices", "en:meals", "en:microwave-meals"])).toBe(
      "cereales_y_granos"
    );
  });
  it("fixes order bugs of the generic map", () => {
    expect(resolveCategory(["en:legumes", "en:peanuts", "en:peanut-butters"])).toBe("frutos_secos");
    expect(resolveCategory(["en:legumes", "en:legume-based-drinks", "en:soy-based-drinks"])).toBe(
      "bebidas"
    );
    expect(resolveCategory(["en:legumes", "en:green-beans"])).toBe("vegetales");
    expect(resolveCategory(["en:pastas", "en:pasta-dishes"])).toBe("otros");
    expect(resolveCategory(["en:desserts", "en:dairy-desserts", "en:dairies"])).toBe("lacteos");
  });
  it("fills gaps and falls back to the generic map", () => {
    expect(resolveCategory(["en:broths"])).toBe("condimentos_y_salsas");
    expect(resolveCategory(["en:eggs"])).toBe("huevos");
  });
  it("returns null when unresolved or empty", () => {
    expect(resolveCategory(["en:plant-based-foods"])).toBeNull();
    expect(resolveCategory([])).toBeNull();
    expect(resolveCategory(undefined)).toBeNull();
  });
  it("name family only applies to tagless rows", () => {
    expect(resolveCategory([], { nameFamily: "pasta_dry" })).toBe("cereales_y_granos");
    expect(resolveCategory([], { nameFamily: "legumes_dry" })).toBe("legumbres");
    expect(resolveCategory(["en:plant-based-foods"], { nameFamily: "pasta_dry" })).toBeNull();
  });
});
