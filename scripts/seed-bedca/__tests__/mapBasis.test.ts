/**
 * Tests for scripts/seed-bedca/mapBasis.ts (task 5.6)
 *
 * Verifies:
 *   - Raw staple names → "crudo"
 *   - Cooked variant names → "cocido"
 *   - Indeterminate names → null (never guessed)
 */

import { mapBasis } from "../mapBasis";

describe("mapBasis()", () => {
  // ── Raw indicators ─────────────────────────────────────────────────────

  it("'Pollo, pechuga, crudo' → 'crudo'", () => {
    expect(mapBasis("Pollo, pechuga, crudo")).toBe("crudo");
  });

  it("'Arroz, crudo' → 'crudo'", () => {
    expect(mapBasis("Arroz, crudo")).toBe("crudo");
  });

  it("'Garbanzo, seco' → 'crudo' (seco = raw/uncooked for legumes)", () => {
    expect(mapBasis("Garbanzo, seco")).toBe("crudo");
  });

  it("'Lentejas, sin cocer' → 'crudo'", () => {
    expect(mapBasis("Lentejas, sin cocer")).toBe("crudo");
  });

  it("'Atún fresco' → 'crudo'", () => {
    expect(mapBasis("Atún fresco")).toBe("crudo");
  });

  // ── Cooked indicators ─────────────────────────────────────────────────

  it("'Pollo, pechuga, a la plancha' → 'cocido'", () => {
    expect(mapBasis("Pollo, pechuga, a la plancha")).toBe("cocido");
  });

  it("'Arroz, hervido' → 'cocido'", () => {
    expect(mapBasis("Arroz, hervido")).toBe("cocido");
  });

  it("'Garbanzo, cocido' → 'cocido'", () => {
    expect(mapBasis("Garbanzo, cocido")).toBe("cocido");
  });

  it("'Huevo de gallina, hervido, duro' → 'cocido'", () => {
    expect(mapBasis("Huevo de gallina, hervido, duro")).toBe("cocido");
  });

  it("'Pescado asado al horno' → 'cocido'", () => {
    expect(mapBasis("Pescado asado al horno")).toBe("cocido");
  });

  it("'Carne frita' → 'cocido'", () => {
    expect(mapBasis("Carne frita")).toBe("cocido");
  });

  // ── When both cooked and raw terms appear, cocido wins ────────────────

  it("when both 'crudo' and 'cocido' appear, 'cocido' wins", () => {
    expect(mapBasis("Comparación crudo vs cocido")).toBe("cocido");
  });

  // ── Indeterminate — fail-closed to null ───────────────────────────────

  it("'Queso curado' → null (no raw/cooked indicator)", () => {
    expect(mapBasis("Queso curado")).toBeNull();
  });

  it("'Leche entera' → null", () => {
    expect(mapBasis("Leche entera")).toBeNull();
  });

  it("'Pan integral' → null", () => {
    expect(mapBasis("Pan integral")).toBeNull();
  });

  it("empty string → null", () => {
    expect(mapBasis("")).toBeNull();
  });

  it("does NOT return 'crudo' for unknown foods (fail-closed)", () => {
    const result = mapBasis("Alimento desconocido XYZ");
    expect(result).not.toBe("crudo");
    expect(result).toBeNull();
  });
});
