import {
  brandVariantsFor,
  canonicalBrand,
  cleanName,
  isHacendadoBrand,
  stripPackSize,
} from "../cleanName";

describe("cleanName", () => {
  it("collapses whitespace and strips brand and pack size", () => {
    expect(cleanName("  Espaguetis   Hacendado 500 g ", ["Hacendado"])).toBe("Espaguetis");
    expect(cleanName("Garbanzos cocidos 400g", [])).toBe("Garbanzos cocidos");
    expect(cleanName("Leche entera x6", [])).toBe("Leche entera");
    expect(cleanName("Yogur 4 x 125 g", [])).toBe("Yogur");
  });
  it("fixes ALL-CAPS to sentence case and capitalizes lowercase starts", () => {
    expect(cleanName("ARROZ LARGO", [])).toBe("Arroz largo");
    expect(cleanName("arroz largo", [])).toBe("Arroz largo");
  });
  it("keeps short acronyms and mixed case untouched", () => {
    expect(cleanName("Pasta DOP", [])).toBe("Pasta DOP");
  });
  it("returns null when nothing meaningful is left", () => {
    expect(cleanName("Hacendado 500 g", ["Hacendado"])).toBeNull();
    expect(cleanName("   ", [])).toBeNull();
    expect(cleanName(null, [])).toBeNull();
  });
  it("does not strip a brand embedded in another word", () => {
    expect(cleanName("Hacendadoso", ["Hacendado"])).toBe("Hacendadoso");
  });
  it("stripPackSize leaves names without trailing sizes alone", () => {
    expect(stripPackSize("Pasta 100% integral")).toBe("Pasta 100% integral");
  });
});

describe("brand", () => {
  it("collapses every Hacendado variant", () => {
    expect(canonicalBrand("Hacendado", ["xx:hacendado"])).toBe("Hacendado");
    expect(canonicalBrand("Hacendado Mercadona", [])).toBe("Hacendado");
    expect(canonicalBrand("x", ["xx:el-hacendado"])).toBe("Hacendado");
    expect(isHacendadoBrand(null, [])).toBe(false);
  });
  it("title-cases all-caps brands and keeps mixed case", () => {
    expect(canonicalBrand("GALLO, Otra", [])).toBe("Gallo");
    expect(canonicalBrand("Bomba de Oro", [])).toBe("Bomba de Oro");
    expect(canonicalBrand("", [])).toBeNull();
  });
  it("brandVariantsFor adds Mercadona for Hacendado", () => {
    expect(brandVariantsFor("Hacendado", "Hacendado")).toEqual(
      expect.arrayContaining(["Hacendado", "Mercadona"])
    );
  });
});
