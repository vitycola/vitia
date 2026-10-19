import { canConvert, resolveCookingFactor } from "../cookingConversion";
import {
  PASTA_DRY_COOKING_FACTOR,
  STAPLE_COOKED_MAX_KCAL,
  STAPLE_RAW_MIN_KCAL,
  cookingFactorFromOffTags,
  deriveOffCookingFields,
  inferStapleBasis,
  resolveOffBasis,
  stapleGroupFromOffTags,
} from "../offBasisInference";
import { categoryFromOffTags } from "../offCategoryMap";

const PASTA_TAGS = [
  "en:plant-based-foods",
  "en:cereals-and-potatoes",
  "en:pastas",
  "en:dry-pastas",
];

describe("stapleGroupFromOffTags", () => {
  it("detects each staple group", () => {
    expect(stapleGroupFromOffTags(["en:pastas"])).toBe("pasta");
    expect(stapleGroupFromOffTags(["en:rices"])).toBe("rice");
    expect(stapleGroupFromOffTags(["en:pulses", "en:legumes"])).toBe("legumes");
    expect(stapleGroupFromOffTags(["en:lentils"])).toBe("legumes");
    expect(stapleGroupFromOffTags(["en:quinoa"])).toBe("grains");
    expect(stapleGroupFromOffTags(["en:couscous"])).toBe("grains");
  });

  it("returns null for non-staples and missing tags", () => {
    expect(stapleGroupFromOffTags(["en:meats"])).toBeNull();
    expect(stapleGroupFromOffTags(["en:legumes"])).toBeNull(); // too broad (peanuts, green beans)
    expect(stapleGroupFromOffTags([])).toBeNull();
    expect(stapleGroupFromOffTags(undefined)).toBeNull();
  });

  it("excludes dishes, stuffed/fresh pasta and other non-staple forms", () => {
    expect(stapleGroupFromOffTags(["en:pastas", "en:pasta-dishes"])).toBeNull();
    expect(stapleGroupFromOffTags(["en:pastas", "en:stuffed-pastas"])).toBeNull();
    expect(stapleGroupFromOffTags(["en:pastas", "en:fresh-pasta"])).toBeNull();
    expect(stapleGroupFromOffTags(["en:rices", "en:rice-dishes"])).toBeNull();
    expect(stapleGroupFromOffTags(["en:pulses", "en:frozen-foods"])).toBeNull();
  });
});

describe("inferStapleBasis thresholds", () => {
  it("is crudo at and above the raw minimum", () => {
    expect(inferStapleBasis(PASTA_TAGS, STAPLE_RAW_MIN_KCAL)).toBe("crudo");
    expect(inferStapleBasis(PASTA_TAGS, 350)).toBe("crudo");
  });

  it("is null just below the raw minimum and just above the cooked maximum", () => {
    expect(inferStapleBasis(PASTA_TAGS, STAPLE_RAW_MIN_KCAL - 0.1)).toBeNull();
    expect(inferStapleBasis(PASTA_TAGS, STAPLE_COOKED_MAX_KCAL + 0.1)).toBeNull();
    expect(inferStapleBasis(PASTA_TAGS, 250)).toBeNull();
  });

  it("is cocido at and below the cooked maximum", () => {
    expect(inferStapleBasis(PASTA_TAGS, STAPLE_COOKED_MAX_KCAL)).toBe("cocido");
    expect(inferStapleBasis(["en:rices"], 130)).toBe("cocido");
  });

  it("is null when kcal is missing, zero, negative or not finite", () => {
    expect(inferStapleBasis(PASTA_TAGS, undefined)).toBeNull();
    expect(inferStapleBasis(PASTA_TAGS, null)).toBeNull();
    expect(inferStapleBasis(PASTA_TAGS, 0)).toBeNull();
    expect(inferStapleBasis(PASTA_TAGS, -5)).toBeNull();
    expect(inferStapleBasis(PASTA_TAGS, Number.NaN)).toBeNull();
    expect(inferStapleBasis(PASTA_TAGS, Number.POSITIVE_INFINITY)).toBeNull();
  });

  it("never infers for non-staple categories, whatever the kcal", () => {
    expect(inferStapleBasis(["en:meats"], 350)).toBeNull();
    expect(inferStapleBasis(["en:meats"], 100)).toBeNull();
    expect(inferStapleBasis(["en:vegetables"], 350)).toBeNull();
    expect(inferStapleBasis(undefined, 350)).toBeNull();
  });
});

describe("resolveOffBasis", () => {
  it("lets an explicit cooked tag win over a dry-looking kcal value", () => {
    expect(resolveOffBasis(["en:pastas", "en:cooked-foods"], 360)).toBe("cocido");
    expect(resolveOffBasis(["en:pulses", "en:canned-legumes"], 340)).toBe("cocido");
  });

  it("infers crudo for dry staples without a cooked tag", () => {
    expect(resolveOffBasis(PASTA_TAGS, 355)).toBe("crudo");
  });

  it("keeps non-staples fail-closed (null) without a cooked tag", () => {
    expect(resolveOffBasis(["en:meats"], 350)).toBeNull();
    expect(resolveOffBasis(["en:breads"], 260)).toBeNull();
  });

  it("still resolves cocido from tags alone for non-staples", () => {
    expect(resolveOffBasis(["en:canned-vegetables"], undefined)).toBe("cocido");
  });
});

describe("cookingFactorFromOffTags", () => {
  it("returns the dry pasta factor only for crudo pasta", () => {
    expect(cookingFactorFromOffTags(PASTA_TAGS, "crudo")).toBe(PASTA_DRY_COOKING_FACTOR);
    expect(cookingFactorFromOffTags(PASTA_TAGS, "cocido")).toBeNull();
    expect(cookingFactorFromOffTags(PASTA_TAGS, null)).toBeNull();
  });

  it("returns null for rice, noodles and other groups", () => {
    expect(cookingFactorFromOffTags(["en:rices"], "crudo")).toBeNull();
    expect(cookingFactorFromOffTags(["en:pulses"], "crudo")).toBeNull();
    expect(cookingFactorFromOffTags(["en:pastas", "en:noodles"], "crudo")).toBeNull();
    expect(cookingFactorFromOffTags(undefined, "crudo")).toBeNull();
  });
});

describe("toggle availability for an OFF dry pasta fixture", () => {
  // Mirrors the resolution steps of normalizeOffProduct (the module itself
  // cannot be imported under ts-jest because of import.meta.env).
  function resolve(tags: string[], kcal: number) {
    const dataBasis = resolveOffBasis(tags, kcal);
    return {
      category: categoryFromOffTags(tags),
      dataBasis,
      cookingFactor: cookingFactorFromOffTags(tags, dataBasis),
    };
  }

  it("makes canConvert true for dry pasta and uses the pasta factor", () => {
    const food = resolve(PASTA_TAGS, 356);
    expect(food.dataBasis).toBe("crudo");
    expect(canConvert(food)).toBe(true);
    expect(resolveCookingFactor(food.category, food.cookingFactor)).toBe(PASTA_DRY_COOKING_FACTOR);
  });

  it("makes canConvert true for dry rice via the category factor", () => {
    const food = resolve(["en:rices"], 350);
    expect(food.cookingFactor).toBeNull();
    expect(canConvert(food)).toBe(true);
  });

  it("keeps the toggle hidden for ambiguous kcal or non-staples", () => {
    expect(canConvert(resolve(PASTA_TAGS, 240))).toBe(false);
    expect(canConvert(resolve(["en:meats"], 350))).toBe(false);
  });
});

describe("deriveOffCookingFields (used by normalizeOffProduct)", () => {
  it("dry pasta at 349 kcal -> crudo with the pasta factor", () => {
    expect(deriveOffCookingFields(PASTA_TAGS, 349)).toEqual({
      dataBasis: "crudo",
      cookingFactor: PASTA_DRY_COOKING_FACTOR,
    });
  });

  it("pasta at 150 kcal -> cocido, no factor", () => {
    expect(deriveOffCookingFields(PASTA_TAGS, 150)).toEqual({
      dataBasis: "cocido",
      cookingFactor: null,
    });
  });

  it("non-staple stays unresolved", () => {
    expect(deriveOffCookingFields(["en:meats", "en:poultry"], 350)).toEqual({
      dataBasis: null,
      cookingFactor: null,
    });
    expect(deriveOffCookingFields(undefined, undefined)).toEqual({
      dataBasis: null,
      cookingFactor: null,
    });
  });

  it("an explicit cooked tag wins and yields no factor", () => {
    expect(deriveOffCookingFields(["en:pastas", "en:cooked-foods"], 355)).toEqual({
      dataBasis: "cocido",
      cookingFactor: null,
    });
  });
});

describe("noodles are excluded from staple inference", () => {
  it("returns null basis and no factor, whatever the kcal", () => {
    const tags = ["en:pastas", "en:noodles", "en:dry-pastas"];
    expect(stapleGroupFromOffTags(tags)).toBeNull();
    expect(deriveOffCookingFields(tags, 355)).toEqual({ dataBasis: null, cookingFactor: null });
    const rice = ["en:pastas", "en:rice-noodles", "en:rice-vermicelli"];
    expect(deriveOffCookingFields(rice, 360)).toEqual({ dataBasis: null, cookingFactor: null });
  });
});

// Tag sets taken from real OFF products sold in Spain (trimmed of the generic
// "plant-based-foods" ancestors). Expected values follow the rules above.
type Row = [string, string[], number, "crudo" | "cocido" | null, number | null];
const REAL: Row[] = [
  // pasta
  [
    "dry pasta 8410693801143",
    ["en:cereals-and-potatoes", "en:pastas", "en:dry-pastas"],
    349,
    "crudo",
    2.9,
  ],
  [
    "dry penne 8005709104075",
    [
      "en:pastas",
      "en:cereal-pastas",
      "en:durum-wheat-pasta",
      "en:dry-pastas",
      "en:penne",
      "en:penne-rigate",
    ],
    354,
    "crudo",
    2.9,
  ],
  [
    "cooked fideua 8431876343014",
    ["en:pastas", "en:cereal-pastas", "es:fideua-de-trigo-duro"],
    128,
    "cocido",
    null,
  ],
  [
    "fresh stuffed ravioli 8006013990163",
    [
      "en:meals",
      "en:pasta-dishes",
      "en:pastas",
      "en:stuffed-pastas",
      "en:fresh-pasta",
      "en:raviolis",
    ],
    286,
    null,
    null,
  ],
  [
    "cannelloni dish 8005709191181",
    [
      "en:meals",
      "en:pasta-dishes",
      "en:pastas",
      "en:stuffed-pastas",
      "en:cannelloni",
      "en:dry-pastas",
    ],
    354,
    null,
    null,
  ],
  [
    "instant noodles 8714100402016",
    ["en:dried-products-to-be-rehydrated", "en:pastas", "en:noodles", "en:instant-noodles"],
    370,
    null,
    null,
  ],
  [
    "dry durum noodles 3560070329182",
    ["en:pastas", "en:durum-wheat-pasta", "en:noodles", "en:dry-pastas"],
    355,
    null,
    null,
  ],
  // rice
  [
    "dry long grain 8480017058133",
    ["en:cereal-grains", "en:rices", "en:long-grain-rices"],
    351,
    "crudo",
    null,
  ],
  [
    "dry bomba 8411495112369",
    [
      "en:cereal-grains",
      "en:rices",
      "en:rices-for-paella",
      "en:short-grain-rices",
      "en:bomba-rices",
    ],
    332,
    "crudo",
    null,
  ],
  [
    "cooked jasmine 5016805008627",
    ["en:cereal-grains", "en:rices", "en:jasmine-rice"],
    140,
    "cocido",
    null,
  ],
  [
    "rice dish 0054800020010",
    ["en:meals", "en:cereal-grains", "en:rice-dishes", "en:rices"],
    351,
    null,
    null,
  ],
  [
    "microwave rice pot 8410184030311",
    ["en:meals", "en:rices", "en:microwave-meals", "en:pots", "en:rice-in-pots"],
    355,
    null,
    null,
  ],
  [
    "risotto mix 8018370004841",
    ["en:meals", "en:rice-dishes", "en:rices", "en:risottos"],
    399,
    null,
    null,
  ],
  ["rice snack", ["en:rices", "en:snacks", "en:salty-snacks"], 380, null, null],
  // legumes
  [
    "dry lentils 8420933000465",
    ["en:legumes", "en:legume-seeds", "en:pulses", "en:lentils", "en:brown-lentils"],
    303,
    "crudo",
    null,
  ],
  [
    "dry chickpeas 8410505520101",
    ["en:legumes", "en:pulses", "en:chickpeas", "en:kabuli-chickpeas"],
    333,
    "crudo",
    null,
  ],
  [
    "canned chickpeas 8412833406768",
    ["en:canned-foods", "en:legumes", "en:pulses", "en:chickpeas", "en:canned-legumes"],
    95,
    "cocido",
    null,
  ],
  ["legume snack", ["en:legumes", "en:pulses", "en:chickpeas", "en:snacks"], 450, null, null],
  ["frozen peas", ["en:legumes", "en:pulses", "en:frozen-foods", "en:vegetables"], 80, null, null],
  // grains
  ["dry quinoa", ["en:cereal-grains", "en:quinoa"], 360, "crudo", null],
];

describe("real tag sets regression table", () => {
  it.each(REAL)("%s", (_name, tags, kcal, basis, factor) => {
    expect(deriveOffCookingFields(tags, kcal)).toEqual({ dataBasis: basis, cookingFactor: factor });
  });
});
