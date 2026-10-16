import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { applyFactor, loadStapleFactors, parseStapleFactors } from "../factors";

describe("staple factors", () => {
  const factors = parseStapleFactors('{"pasta_dry":{"factor":2.9,"source":"x"}}');
  it("applies only to crudo rows with a matching rule", () => {
    expect(applyFactor(factors, "crudo", "pasta_dry")).toBe(2.9);
    expect(applyFactor(factors, "cocido", "pasta_dry")).toBeNull();
    expect(applyFactor(factors, null, "pasta_dry")).toBeNull();
    expect(applyFactor(factors, "crudo", "rice_dry")).toBeNull();
    expect(applyFactor(factors, "crudo", null)).toBeNull();
  });
  it("a missing file yields no factors", () => {
    expect(loadStapleFactors(join(tmpdir(), "does-not-exist-factors.json"))).toEqual({});
  });
  it("loads a file and rejects invalid factors", () => {
    const dir = mkdtempSync(join(tmpdir(), "factors-"));
    const f = join(dir, "f.json");
    writeFileSync(f, '{"rice_dry":{"factor":2.5,"source":"s"}}');
    expect(loadStapleFactors(f).rice_dry.factor).toBe(2.5);
    expect(() => parseStapleFactors('{"a":{"factor":0,"source":""}}')).toThrow();
    expect(() => parseStapleFactors('{"a":{"factor":"2","source":""}}')).toThrow();
  });
});
