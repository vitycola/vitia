import { getConfidenceMeta } from "@/lib/aiConfidence";

describe("getConfidenceMeta", () => {
  it("returns correct meta for high confidence", () => {
    const meta = getConfidenceMeta("high");
    expect(meta.label).toBe("Alta");
    expect(meta.color).toBe("#16a34a");
    expect(meta.defaultChecked).toBe(true);
    expect(meta.highlight).toBe(false);
  });

  it("returns correct meta for medium confidence", () => {
    const meta = getConfidenceMeta("medium");
    expect(meta.label).toBe("Revisar");
    expect(meta.color).toBe("#F5A623");
    expect(meta.defaultChecked).toBe(true);
    expect(meta.highlight).toBe(true);
  });

  it("returns correct meta for low confidence", () => {
    const meta = getConfidenceMeta("low");
    expect(meta.label).toBe("Editar");
    expect(meta.color).toBe("#FF3B30");
    expect(meta.defaultChecked).toBe(false);
    expect(meta.highlight).toBe(false);
  });
});
