import { mkdtempSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { SeedRecord } from "../curate";
import { buildChunkSql, chunkRecords, sqlNum, sqlStr, valuesRow, writeSqlChunks } from "../toSql";

const rec = (i: number, name = "Espaguetis"): SeedRecord => ({
  code: String(i),
  id: `00000000-0000-5000-8000-${String(i).padStart(12, "0")}`,
  name,
  name_normalized: name.toLowerCase(),
  brand: "Hacendado",
  calories_per_100g: 357,
  protein_per_100g: 12,
  carbs_per_100g: 72,
  fat_per_100g: 1.5,
  category: "cereales_y_granos",
  data_basis: "crudo",
  cooking_factor: null,
  staple_rule: "pasta_dry",
  basis_reason: "x",
  hacendado: true,
  completeness: 0,
  last_modified_t: 0,
});

describe("sqlStr", () => {
  it("doubles single quotes (injection attempt stays inert)", () => {
    expect(sqlStr("O'Brien'); drop table generic_foods;--")).toBe(
      "'O''Brien''); drop table generic_foods;--'"
    );
  });
  it("uses an E-string with doubled backslashes when needed", () => {
    expect(sqlStr("a\\b'c")).toBe("E'a\\\\b''c'");
  });
  it("strips control characters, keeps unicode, handles null", () => {
    expect(sqlStr("a\u0000b\nc")).toBe("'a b c'");
    expect(sqlStr("Ñoquis 🍝")).toBe("'Ñoquis 🍝'");
    expect(sqlStr(null)).toBe("NULL");
  });
  it("sqlNum maps null / non-finite to NULL", () => {
    expect(sqlNum(null)).toBe("NULL");
    expect(sqlNum(Number.NaN)).toBe("NULL");
    expect(sqlNum(2.9)).toBe("2.9");
  });
});

describe("chunking and rendering", () => {
  it("chunks by size", () => {
    expect(chunkRecords([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });
  it("renders an idempotent, self-contained upsert", () => {
    const sql = buildChunkSql([rec(1), rec(2)], 1, 1);
    expect(sql).toContain("on conflict (id) do update set");
    expect(sql).toContain("begin;");
    expect(sql).toContain("commit;");
    expect(sql).toContain("'openfoodfacts'");
    expect(valuesRow(rec(1))).toContain("::uuid");
  });
  it("writes numbered files of at most the chunk size", () => {
    const dir = mkdtempSync(join(tmpdir(), "sql-"));
    const names = writeSqlChunks(
      Array.from({ length: 7 }, (_, i) => rec(i)),
      dir,
      3
    );
    expect(names).toEqual([
      "01_generic_foods_off.sql",
      "02_generic_foods_off.sql",
      "03_generic_foods_off.sql",
    ]);
    expect(readdirSync(dir)).toHaveLength(3);
    expect(readFileSync(join(dir, names[2]), "utf8").match(/^\('/gm)).toHaveLength(1);
  });
});
