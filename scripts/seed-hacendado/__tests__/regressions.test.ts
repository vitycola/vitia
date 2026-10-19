/**
 * Named-fixture regression tests: one block per defect class found by the
 * data-quality audit. Each fixture mirrors a real Open Food Facts row shape.
 */

import { normalizeForSearch } from "../../../lib/search";
import { canonicalBrand, cleanName } from "../cleanName";
import { type OffRow, type SeedRecord, curateRow, dedupe, dedupeKey } from "../curate";
import { isPlainDurumPasta } from "../nameRules";

const FACTORS = { pasta_dry: { factor: 2.9, source: "test" } };
const BASE: OffRow = {
  code: "1",
  brands: "Hacendado",
  brands_tags: ["xx:hacendado"],
  stores_tags: ["mercadona"],
  name_es: "x",
  name_main: null,
  name_first: null,
  categories_tags: [],
  countries_tags: ["en:spain"],
  nutrition_data_per: "100g",
  no_nutrition_data: false,
  obsolete: false,
  last_modified_t: 1,
  completeness: 0.5,
  kcal: 357,
  kj: null,
  protein: 12,
  carbs: 72,
  fat: 1.5,
};

type Macro = Pick<OffRow, "kcal" | "protein" | "carbs" | "fat">;
const PASTA: Macro = { kcal: 357, protein: 12, carbs: 72, fat: 1.5 };
const COOKED_RICE: Macro = { kcal: 146, protein: 3, carbs: 32, fat: 0.4 };
const DRY_LEGUME: Macro = { kcal: 300, protein: 21, carbs: 50, fat: 2 };
const CANNED_LEGUME: Macro = { kcal: 83, protein: 6, carbs: 12, fat: 0.5 };

function rec(over: Partial<OffRow>, factors = FACTORS): SeedRecord {
  const r = curateRow({ ...BASE, ...over }, factors);
  if (r.kind !== "kept") throw new Error(`expected kept, got ${r.exclusion.reason}`);
  return r.record;
}
function reason(over: Partial<OffRow>): string {
  const r = curateRow({ ...BASE, ...over }, FACTORS);
  return r.kind === "excluded" ? r.exclusion.reason : "kept";
}

const DRY_PASTA_TAGS = ["en:pastas", "en:cereal-pastas", "en:dry-pastas", "en:durum-wheat-pasta"];

describe("defect 1: name veto applies to every row, not only tag-less ones", () => {
  it("Pate de pato al cava (tagged en:pastas) is never crudo and never gets a factor", () => {
    const r = rec({
      name_es: "Pate de pato al cava",
      categories_tags: ["en:meats-and-their-products", "en:meats", "en:pastas", "en:pate"],
      kcal: 340,
      protein: 12,
      carbs: 3,
      fat: 31,
    });
    expect(r.data_basis).toBeNull();
    expect(r.cooking_factor).toBeNull();
    expect(r.category).toBe("carnes");
  });
  it("Mac & Cheese: no basis, no factor, category otros", () => {
    const r = rec({
      name_es: "Mac & Cheese",
      categories_tags: ["en:pastas"],
      kcal: 397,
      protein: 13,
      carbs: 70,
      fat: 7,
    });
    expect([r.data_basis, r.cooking_factor, r.category]).toEqual([null, null, "otros"]);
  });
  it("Canelones precocidos: dry-looking pasta tags but vetoed", () => {
    const r = rec({ name_es: "Canelones precocidos", categories_tags: DRY_PASTA_TAGS, ...PASTA });
    expect([r.data_basis, r.cooking_factor]).toEqual([null, null]);
  });
  it("Masa de hojaldre (dough) is not a staple", () => {
    const r = rec({
      name_es: "Masa de hojaldre",
      categories_tags: ["en:pastas", "en:pie-dough"],
      ...PASTA,
    });
    expect([r.data_basis, r.cooking_factor]).toEqual([null, null]);
  });
  it("Noodles de arroz: basis NULL and no factor", () => {
    const r = rec({
      name_es: "Noodles de arroz",
      categories_tags: ["en:pastas", "en:noodles", "en:rice-pasta"],
      ...PASTA,
    });
    expect([r.data_basis, r.cooking_factor]).toEqual([null, null]);
  });
  it("Avena Chocolate and Harina de Trigo Sarraceno are not plain dry staples", () => {
    const oats = rec({
      name_es: "Avena Chocolate",
      categories_tags: ["en:breakfast-cereals", "en:rolled-oats"],
      kcal: 405,
      protein: 10,
      carbs: 65,
      fat: 10,
    });
    expect(oats.data_basis).toBeNull();
    const flour = rec({
      name_es: "Harina de Trigo Sarraceno",
      categories_tags: ["en:cereal-grains", "en:buckwheat"],
      kcal: 340,
      protein: 13,
      carbs: 70,
      fat: 3,
    });
    expect(flour.data_basis).toBeNull();
  });
});

describe("defect 2: the pasta factor is only for plain durum-wheat pasta", () => {
  it("plain durum spaghetti gets 2.9", () => {
    const r = rec({ name_es: "Espaguetis", categories_tags: DRY_PASTA_TAGS, ...PASTA });
    expect([r.data_basis, r.cooking_factor]).toEqual(["crudo", 2.9]);
  });
  it("a plain pasta-shape name without tags evidence (Hacendado, no durum tag) also gets it", () => {
    expect(isPlainDurumPasta(["en:pastas"], "Penne")).toBe(true);
  });
  it.each([
    ["Espaguetis integrales", DRY_PASTA_TAGS],
    ["Fusilli de lenteja roja", ["en:pastas", "en:dry-pastas", "en:legumes"]],
    ["Penne de garbanzo", ["en:pastas", "en:dry-pastas"]],
    ["Macarrones de arroz", ["en:pastas", "en:rice-pasta"]],
    ["Fusilli sin gluten", ["en:pastas", "en:gluten-free-pasta"]],
    ["Penne de trigo sarraceno", ["en:pastas", "en:buckwheat-pasta"]],
    ["Espaguetis de espelta", ["en:pastas", "en:spelt-pastas"]],
    ["Espaguetis trigo", ["en:pastas"]],
    ["Fideos de huevo", ["en:pastas", "en:egg-noodles"]],
  ])("%s keeps crudo (if dry) but has NO factor", (name, tags) => {
    const r = rec({ name_es: name, categories_tags: tags, ...PASTA });
    expect(r.cooking_factor).toBeNull();
  });
  it("couscous is a grain: no pasta rule, no factor, even when tagged en:pastas", () => {
    const r = rec({
      name_es: "Cous cous",
      categories_tags: ["en:pastas", "en:couscous"],
      ...PASTA,
    });
    expect([r.staple_rule, r.cooking_factor, r.data_basis]).toEqual(["grains_dry", null, "crudo"]);
  });
  it("pasta mis-tagged only as legumes is still pasta by name", () => {
    const r = rec({
      name_es: "Espirales tricolor",
      categories_tags: ["en:legumes", "en:pulses"],
      brands: "carrefour",
      brands_tags: ["carrefour"],
      stores_tags: [],
      kcal: 344,
      protein: 12,
      carbs: 70,
      fat: 1.5,
    });
    expect([r.category, r.staple_rule]).toEqual(["cereales_y_granos", "pasta_dry"]);
  });
});

describe("defect 3/7: dry vs cooked legumes and rice; dishes get NULL", () => {
  const LEG = ["en:legumes", "en:pulses", "en:common-beans", "en:legume-seeds"];
  const CANNED = [...LEG, "en:canned-foods", "en:canned-legumes"];
  it("Alubia Blanca dry is crudo, canned is cocido", () => {
    expect(rec({ name_es: "Alubia Blanca", categories_tags: LEG, ...DRY_LEGUME }).data_basis).toBe(
      "crudo"
    );
    const c = rec({ name_es: "Alubia Blanca", categories_tags: CANNED, ...CANNED_LEGUME });
    expect([c.data_basis, c.category, c.cooking_factor]).toEqual(["cocido", "legumbres", null]);
  });
  it("Lentejas dry vs cooked", () => {
    expect(
      rec({ name_es: "Lentejas", categories_tags: ["en:lentils", "en:legumes"], ...DRY_LEGUME })
        .data_basis
    ).toBe("crudo");
    expect(
      rec({
        name_es: "Lentejas",
        categories_tags: ["en:legumes", "en:canned-lentils"],
        ...CANNED_LEGUME,
      }).data_basis
    ).toBe("cocido");
  });
  it("plain cooked rice is cocido", () => {
    const r = rec({
      name_es: "Arroz cocido",
      categories_tags: ["en:precooked-rices", "en:prepared-rices", "en:meals"],
      ...COOKED_RICE,
    });
    expect(r.data_basis).toBe("cocido");
  });
  it.each([
    ["Arroz tres delicias", ["en:rices", "en:prepared-rices", "en:rice-dishes"], COOKED_RICE],
    ["Alubias a la jardinera", ["en:legumes", "en:canned-legumes"], CANNED_LEGUME],
    ["Garbanzos con espinacas", ["en:legumes", "en:canned-legumes"], CANNED_LEGUME],
    ["Garbanzos con verduras", ["en:legumes", "en:canned-legumes"], CANNED_LEGUME],
    ["Guisantes extra", ["en:legumes", "en:canned-legumes"], CANNED_LEGUME],
    ["Arroz de secreto con setas", ["en:rices", "en:precooked-rices"], COOKED_RICE],
  ])("dish %s is never cocido", (name, tags, macros) => {
    expect(rec({ name_es: name, categories_tags: tags, ...macros }).data_basis).toBeNull();
  });
  it("Arroz tres delicias is categorized as a dish (otros)", () => {
    expect(
      rec({
        name_es: "Arroz tres delicias",
        categories_tags: ["en:rices", "en:meals"],
        ...COOKED_RICE,
      }).category
    ).toBe("otros");
  });
});

describe("defect 5: category vetoes", () => {
  const cat = (name: string, tags: string[], m: Macro = PASTA) =>
    rec({ name_es: name, categories_tags: tags, ...m }).category;
  it("Espirales de calabacín is a vegetable, not a grain", () => {
    expect(
      cat("Espirales de calabacín", ["en:pastas"], { kcal: 22, protein: 1, carbs: 4, fat: 0.3 })
    ).toBe("vegetales");
  });
  it("Sorbete con fresas is a sweet", () => {
    expect(
      cat("Sorbete con fresas", ["en:desserts", "en:frozen-desserts", "en:sorbets"], {
        kcal: 90,
        protein: 0.5,
        carbs: 22,
        fat: 0,
      })
    ).toBe("dulces_y_snacks");
  });
  it("tag-less pasta-looking names that are dishes or seeds do not fall into cereales", () => {
    const small: Macro = { kcal: 150, protein: 5, carbs: 25, fat: 3 };
    expect(cat("Pizza de pasta", [], small)).toBe("otros");
    expect(cat("Risotto de setas", [], small)).toBe("otros");
    expect(cat("Semillas de sésamo", [], { kcal: 573, protein: 18, carbs: 23, fat: 50 })).toBe(
      "frutos_secos"
    );
  });
  it("fresh/frozen peas are vegetables; Bebida de guisantes is a drink", () => {
    expect(
      cat("Guisantes", ["en:legumes", "en:frozen-foods"], {
        kcal: 70,
        protein: 5,
        carbs: 9,
        fat: 0.5,
      })
    ).toBe("vegetales");
    expect(
      cat("Bebida de guisantes", ["en:beverages", "en:plant-based-beverages"], {
        kcal: 30,
        protein: 2,
        carbs: 1,
        fat: 2,
      })
    ).toBe("bebidas");
  });
  it("real meat tagged as a meat analogue is meat; seitan stays otros", () => {
    const m: Macro = { kcal: 240, protein: 20, carbs: 0, fat: 17 };
    expect(cat("Alitas de pollo", ["en:meat-analogues"], m)).toBe("carnes");
    expect(cat("Seitán", ["en:meat-analogues", "en:seitan"], m)).toBe("otros");
  });
});

describe("defect 6: powdered beverages are excluded", () => {
  const coffee = ["en:beverages", "en:coffees", "en:instant-coffees"];
  it("Café Descafeinado powder (kcal > 150 per 100 g) is excluded", () => {
    expect(
      reason({
        name_es: "Café Descafeinado",
        categories_tags: coffee,
        kcal: 275,
        protein: 12,
        carbs: 40,
        fat: 0.5,
      })
    ).toBe("powder_beverage_per_100g");
  });
  it("a ready drink with low kcal is kept; cacao soluble is not treated as coffee", () => {
    expect(
      reason({
        name_es: "Café Descafeinado",
        categories_tags: coffee,
        kcal: 5,
        protein: 0.5,
        carbs: 0.5,
        fat: 0,
      })
    ).toBe("kept");
    expect(
      reason({
        name_es: "Cacao soluble",
        categories_tags: [],
        kcal: 377,
        protein: 8,
        carbs: 80,
        fat: 3,
      })
    ).toBe("kept");
    expect(
      reason({
        name_es: "Puré te patata",
        categories_tags: [],
        kcal: 341,
        protein: 8,
        carbs: 70,
        fat: 1,
      })
    ).toBe("kept");
  });
});

describe("defect 4: dedupe keeps different product forms and disambiguates names", () => {
  const dryBeans = (code: string) =>
    rec({
      code,
      name_es: "Alubia pinta",
      categories_tags: ["en:legumes", "en:pulses", "en:common-beans"],
      ...DRY_LEGUME,
    });
  const cannedBeans = (code: string) =>
    rec({
      code,
      name_es: "Alubia pinta",
      categories_tags: ["en:legumes", "en:canned-legumes"],
      ...CANNED_LEGUME,
    });
  it("keeps dry and canned with the same name, suffixed, with name_normalized recomputed", () => {
    const { kept, dropped } = dedupe([dryBeans("1"), cannedBeans("2")]);
    expect(dropped).toHaveLength(0);
    expect(kept.map((k) => k.name).sort()).toEqual([
      "Alubia pinta (cocido)",
      "Alubia pinta (en seco)",
    ]);
    for (const k of kept) expect(k.name_normalized).toBe(normalizeForSearch(k.name));
  });
  it("keeps same-basis rows whose kcal differ by more than 25%", () => {
    const a = rec({
      code: "1",
      name_es: "Crema",
      categories_tags: [],
      kcal: 100,
      protein: 3,
      carbs: 10,
      fat: 5,
    });
    const b = rec({
      code: "2",
      name_es: "Crema",
      categories_tags: [],
      kcal: 200,
      protein: 5,
      carbs: 20,
      fat: 11,
    });
    const { kept } = dedupe([a, b]);
    expect(kept.map((k) => k.name).sort()).toEqual(["Crema (100 kcal)", "Crema (200 kcal)"]);
  });
  it("collapses true duplicates (same form, similar kcal)", () => {
    const { kept, dropped } = dedupe([dryBeans("2"), dryBeans("1")]);
    expect(kept).toHaveLength(1);
    expect(kept[0].code).toBe("1");
    expect(dropped).toHaveLength(1);
  });
  it("number markers unify: Spaghetti N3 / nº 3 / N°3", () => {
    const keys = ["Spaghetti N3", "Spaghetti nº 3", "Spaghetti N°3", "Spaghetti no 3"].map((name) =>
      dedupeKey({ name, brand: "Gallo" })
    );
    expect(new Set(keys).size).toBe(1);
    expect(dedupeKey({ name: "Spaghetti N3", brand: "Gallo" })).not.toBe(
      dedupeKey({ name: "Spaghetti N5", brand: "Gallo" })
    );
  });
  it("final kept rows never collide on (name_normalized, brand)", () => {
    const rows = [dryBeans("1"), cannedBeans("2"), dryBeans("3")];
    const { kept } = dedupe(rows);
    const keys = kept.map((k) => `${k.name_normalized}|${k.brand}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe("defect 8: Mercadona brand", () => {
  it("canonicalizes to Hacendado only with Mercadona store evidence", () => {
    expect(canonicalBrand("MERCADONA", [], ["Mercadona"])).toBe("Hacendado");
    expect(canonicalBrand("Mercadona", ["xx:mercadona"], ["mercadona"])).toBe("Hacendado");
    expect(canonicalBrand("Hacendado,Acecook", [], [])).toBe("Hacendado");
    expect(canonicalBrand("MERCADONA", [], [])).toBe("Mercadona");
    expect(canonicalBrand("Carrefour", [], ["mercadona"])).toBe("Carrefour");
  });
});

describe("defect 9: name hygiene", () => {
  it("drops very short names, keeps real short foods", () => {
    expect(reason({ name_es: "Se", categories_tags: [] })).toBe("name_too_short");
    expect(reason({ name_es: "Sal", categories_tags: [] })).toBe("kept");
  });
  it("strips leading emoji", () => {
    expect(cleanName("🍝 Pasta fresca", [])).toBe("Pasta fresca");
  });
  it("replaces Cyrillic lookalikes in an otherwise Latin name, leaves real Cyrillic alone", () => {
    expect(cleanName("Pаsta", [])).toBe("Pasta"); // Cyrillic "а"
    expect(cleanName("Бук Пак", [])).toBe("Бук Пак");
  });
  it("removes empty parentheses left after brand stripping", () => {
    expect(cleanName("Estrellas (Hacendado)", ["Hacendado"])).toBe("Estrellas");
  });
});
