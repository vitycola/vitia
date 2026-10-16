import { determineBasis, hasCookedSignal, nameStapleFamily, stapleFamily } from "../staples";

const dryPasta = ["en:plant-based-foods", "en:pastas", "en:dry-pastas"];

describe("stapleFamily", () => {
  it("detects families by tag", () => {
    expect(stapleFamily(dryPasta)).toBe("pasta_dry");
    expect(stapleFamily(["en:rices"])).toBe("rice_dry");
    expect(stapleFamily(["en:lentils"])).toBe("legumes_dry");
    expect(stapleFamily(["en:quinoa"])).toBe("grains_dry");
    expect(stapleFamily(["en:dairies"])).toBeNull();
  });
});

describe("determineBasis", () => {
  it("dry pasta with dry density is crudo with a rule key", () => {
    expect(
      determineBasis({ tags: dryPasta, kcal: 357, category: "cereales_y_granos" })
    ).toMatchObject({
      basis: "crudo",
      stapleRule: "pasta_dry",
    });
  });
  it("pasta with a dry tag but cooked density stays NULL (ambiguous)", () => {
    expect(
      determineBasis({ tags: dryPasta, kcal: 150, category: "cereales_y_granos" })
    ).toMatchObject({
      basis: null,
      stapleRule: null,
      reason: "staple_density_out_of_dry_band",
    });
  });
  it("canned legumes with cooked density are cocido", () => {
    const tags = ["en:legumes", "en:canned-legumes", "en:canned-foods"];
    expect(determineBasis({ tags, kcal: 101, category: "legumbres" })).toMatchObject({
      basis: "cocido",
      stapleRule: null,
    });
  });
  it("cooked tag with dry density is a conflict, NULL", () => {
    const tags = ["en:legumes", "en:canned-legumes"];
    expect(determineBasis({ tags, kcal: 340, category: "legumbres" }).basis).toBeNull();
  });
  it("pre-cooked rice is cocido; fresh/stuffed/dish tags never become crudo", () => {
    expect(
      determineBasis({ tags: ["en:precooked-rices"], kcal: 150, category: "cereales_y_granos" })
        .basis
    ).toBe("cocido");
    expect(
      determineBasis({
        tags: ["en:pastas", "en:stuffed-pastas"],
        kcal: 350,
        category: "cereales_y_granos",
      }).basis
    ).toBeNull();
    expect(
      determineBasis({ tags: ["en:pastas", "en:meals"], kcal: 350, category: "otros" }).basis
    ).toBeNull();
  });
  it("cooked signals outside grain/legume categories are not turned into a basis", () => {
    expect(
      determineBasis({
        tags: ["en:canned-foods", "en:canned-fishes"],
        kcal: 200,
        category: "pescados_y_mariscos",
      }).basis
    ).toBeNull();
  });
  it("density alone never asserts a basis for a non-staple", () => {
    expect(
      determineBasis({ tags: ["en:dairies"], kcal: 350, category: "lacteos" }).basis
    ).toBeNull();
  });
  it("uses the name fallback only for tagless rows, and still needs the dry band", () => {
    expect(
      determineBasis({
        tags: [],
        kcal: 351,
        category: "cereales_y_granos",
        nameFamily: "pasta_dry",
      })
    ).toMatchObject({
      basis: "crudo",
      stapleRule: "pasta_dry",
    });
    expect(
      determineBasis({
        tags: [],
        kcal: 120,
        category: "cereales_y_granos",
        nameFamily: "pasta_dry",
      }).basis
    ).toBeNull();
    expect(
      determineBasis({
        tags: ["en:dairies"],
        kcal: 351,
        category: "lacteos",
        nameFamily: "pasta_dry",
      }).basis
    ).toBeNull();
  });
});

describe("hasCookedSignal / nameStapleFamily", () => {
  it("recognizes cooked tags", () => {
    expect(hasCookedSignal(["en:canned-chickpeas"])).toBe(true);
    expect(hasCookedSignal(["en:cooked-foods"])).toBe(true);
    expect(hasCookedSignal(["en:rices"])).toBe(false);
  });
  it("name fallback accepts plain staples and rejects dishes", () => {
    expect(nameStapleFamily("Penne")).toBe("pasta_dry");
    expect(nameStapleFamily("Arroz largo integral")).toBe("rice_dry");
    expect(nameStapleFamily("Lentejas pardinas")).toBe("legumes_dry");
    expect(nameStapleFamily("Arroz de pato")).toBeNull();
    expect(nameStapleFamily("Pasta fresca rellena de queso")).toBeNull();
    expect(nameStapleFamily("Lentejas con vegetales")).toBeNull();
    expect(nameStapleFamily("Garbanzos bote")).toBeNull();
  });
});
