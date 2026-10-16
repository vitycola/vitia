import { normalizeForSearch } from "../../../lib/search";
import { type OffRow, curateRow, dedupe } from "../curate";

const base: OffRow = {
  code: "1",
  brands: "Hacendado",
  brands_tags: ["xx:hacendado"],
  name_es: "Espaguetis",
  name_main: null,
  name_first: null,
  categories_tags: ["en:pastas", "en:dry-pastas"],
  countries_tags: ["en:spain"],
  nutrition_data_per: "100g",
  no_nutrition_data: false,
  obsolete: false,
  last_modified_t: 100,
  completeness: 0.5,
  kcal: 357,
  kj: null,
  protein: 12,
  carbs: 72,
  fat: 1.5,
};
const factors = { pasta_dry: { factor: 2.9, source: "t" } };
const row = (o: Partial<OffRow>): OffRow => ({ ...base, ...o });

describe("curateRow", () => {
  it("keeps dry Hacendado pasta as crudo with the pasta factor", () => {
    const r = curateRow(base, factors);
    expect(r.kind).toBe("kept");
    if (r.kind === "kept") {
      expect(r.record).toMatchObject({
        brand: "Hacendado",
        category: "cereales_y_granos",
        data_basis: "crudo",
        staple_rule: "pasta_dry",
        cooking_factor: 2.9,
        name: "Espaguetis",
      });
    }
  });
  it("emits a NULL factor when no factor file entry exists", () => {
    const r = curateRow(base, {});
    expect(r.kind === "kept" && r.record.cooking_factor).toBeNull();
  });
  it("never applies the pasta factor to non-crudo rows", () => {
    const r = curateRow(row({ kcal: 150, carbs: 30, protein: 5, fat: 1 }), factors);
    expect(r.kind === "kept" && r.record.cooking_factor).toBeNull();
    expect(r.kind === "kept" && r.record.data_basis).toBeNull();
  });
  it("name_normalized equals lib/search normalizeForSearch", () => {
    for (const n of ["Ñoquis de patata", "Jamón Serrano", "Crème brûlée", "ÁÉÍÓÚ ü"]) {
      const r = curateRow(row({ name_es: n, categories_tags: [] }), factors);
      expect(r.kind === "kept" && r.record.name_normalized).toBe(
        normalizeForSearch(r.kind === "kept" ? r.record.name : "")
      );
    }
  });
  it("excludes obsolete, no-data, implausible and nameless rows", () => {
    const reason = (o: Partial<OffRow>) => {
      const r = curateRow(row(o), factors);
      return r.kind === "excluded" ? r.exclusion.reason : "kept";
    };
    expect(reason({ obsolete: true })).toBe("obsolete");
    expect(reason({ no_nutrition_data: true })).toBe("no_nutrition_data");
    expect(reason({ kcal: null })).toBe("no_calories");
    expect(reason({ kcal: 900, protein: 1, carbs: 1, fat: 1 })).toBe("atwater_mismatch");
    expect(reason({ name_es: "Hacendado" })).toBe("no_name");
  });
  it("keeps non-Hacendado only when a dry staple is confirmed", () => {
    const other = { brands: "Gallo", brands_tags: ["gallo"] };
    expect(curateRow(row(other), factors).kind).toBe("kept");
    const canned = curateRow(
      row({
        ...other,
        categories_tags: ["en:pastas", "en:canned-foods"],
        kcal: 120,
        carbs: 22,
        protein: 4,
        fat: 1,
      }),
      factors
    );
    expect(canned).toMatchObject({
      kind: "excluded",
      exclusion: { reason: "non_hacendado_staple_not_confirmed_dry" },
    });
    const dairy = curateRow(row({ ...other, categories_tags: ["en:dairies"] }), factors);
    expect(dairy).toMatchObject({ kind: "excluded", exclusion: { reason: "out_of_scope" } });
  });
  it("uses es name, then main, then first", () => {
    const r = curateRow(row({ name_es: null, name_main: "Spaghetti", name_first: "x" }), factors);
    expect(r.kind === "kept" && r.record.name).toBe("Spaghetti");
  });
});

describe("dedupe", () => {
  const rec = (code: string, completeness: number, t: number, name = "Espaguetis") => {
    const r = curateRow(row({ code, completeness, last_modified_t: t, name_es: name }), factors);
    if (r.kind !== "kept") throw new Error("expected kept");
    return r.record;
  };
  it("keeps the most complete, then most recent, then smallest code", () => {
    expect(dedupe([rec("2", 0.4, 1), rec("1", 0.9, 1)]).kept[0].code).toBe("1");
    expect(dedupe([rec("2", 0.5, 5), rec("1", 0.5, 1)]).kept[0].code).toBe("2");
    expect(dedupe([rec("2", 0.5, 5), rec("1", 0.5, 5)]).kept[0].code).toBe("1");
  });
  it("is order-independent and keeps distinct names", () => {
    const a = [rec("1", 0.5, 1), rec("2", 0.5, 1), rec("3", 0.5, 1, "Macarrones")];
    const f = dedupe(a);
    const b = dedupe([...a].reverse());
    expect(f.kept.map((r) => r.code)).toEqual(b.kept.map((r) => r.code));
    expect(f.kept).toHaveLength(2);
    expect(f.dropped).toHaveLength(1);
  });
});
