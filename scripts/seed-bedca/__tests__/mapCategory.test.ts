/**
 * Tests for scripts/seed-bedca/mapCategory.ts (task 5.5)
 *
 * Verifies:
 *   - Known group names produce the correct canonical category key
 *   - Unknown group returns null (never silently returns "otros")
 */

import { mapCategory } from "../mapCategory";

describe("mapCategory()", () => {
  // ── Known mappings ─────────────────────────────────────────────────────

  it("maps 'Verduras y hortalizas' → 'vegetales'", () => {
    expect(mapCategory("Verduras y hortalizas")).toBe("vegetales");
  });

  it("maps 'Frutas y derivados' → 'frutas'", () => {
    expect(mapCategory("Frutas y derivados")).toBe("frutas");
  });

  it("maps 'Cereales y derivados' → 'cereales_y_granos'", () => {
    expect(mapCategory("Cereales y derivados")).toBe("cereales_y_granos");
  });

  it("maps 'Leguminosas y derivados' → 'legumbres'", () => {
    expect(mapCategory("Leguminosas y derivados")).toBe("legumbres");
  });

  it("maps 'Leche y derivados' → 'lacteos'", () => {
    expect(mapCategory("Leche y derivados")).toBe("lacteos");
  });

  it("maps 'Huevos y derivados' → 'huevos'", () => {
    expect(mapCategory("Huevos y derivados")).toBe("huevos");
  });

  it("maps 'Carnes y derivados' → 'carnes'", () => {
    expect(mapCategory("Carnes y derivados")).toBe("carnes");
  });

  it("maps 'Pescados y mariscos' → 'pescados_y_mariscos'", () => {
    expect(mapCategory("Pescados y mariscos")).toBe("pescados_y_mariscos");
  });

  it("maps 'Embutidos y fiambres' → 'fiambres_y_embutidos'", () => {
    expect(mapCategory("Embutidos y fiambres")).toBe("fiambres_y_embutidos");
  });

  it("maps 'Frutos secos y semillas' → 'frutos_secos'", () => {
    expect(mapCategory("Frutos secos y semillas")).toBe("frutos_secos");
  });

  it("maps 'Bebidas alcohólicas' → 'bebidas'", () => {
    expect(mapCategory("Bebidas alcohólicas")).toBe("bebidas");
  });

  it("maps 'Azúcares y dulces' → 'dulces_y_snacks'", () => {
    expect(mapCategory("Azúcares y dulces")).toBe("dulces_y_snacks");
  });

  it("maps 'Aceites y grasas' → 'condimentos_y_salsas'", () => {
    expect(mapCategory("Aceites y grasas")).toBe("condimentos_y_salsas");
  });

  // ── Unknown groups ─────────────────────────────────────────────────────

  it("returns null for a completely unknown group name", () => {
    expect(mapCategory("Alimentos marcianos desconocidos")).toBeNull();
  });

  it("does NOT silently return 'otros' for unknown groups", () => {
    const result = mapCategory("Grupo completamente desconocido XYZ");
    expect(result).not.toBe("otros");
    expect(result).toBeNull();
  });

  it("returns null for an empty string", () => {
    expect(mapCategory("")).toBeNull();
  });
});
