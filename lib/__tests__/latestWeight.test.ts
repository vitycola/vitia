import { pickLatestWeight } from "@/lib/latestWeight";

const TODAY = "2026-01-31";

describe("pickLatestWeight", () => {
  it("returns the weight of the most recent dated entry", () => {
    expect(
      pickLatestWeight(
        [
          { date: "2026-01-09", weightKg: 81.2 },
          { date: "2026-01-01", weightKg: 82 },
        ],
        TODAY
      )
    ).toBe(81.2);
  });

  it("skips entries without a weight, even when they are newer", () => {
    expect(
      pickLatestWeight(
        [
          { date: "2026-01-10", weightKg: null },
          { date: "2026-01-01", weightKg: 82 },
        ],
        TODAY
      )
    ).toBe(82);
  });

  it("returns null when there are no usable weigh-ins", () => {
    expect(pickLatestWeight([], TODAY)).toBeNull();
    expect(pickLatestWeight([{ date: "2026-01-01", weightKg: null }], TODAY)).toBeNull();
  });

  it("ignores future-dated weigh-ins until their day arrives", () => {
    const entries = [
      { date: "2026-01-20", weightKg: 82 },
      { date: "2026-02-05", weightKg: 79 },
    ];
    expect(pickLatestWeight(entries, "2026-01-31")).toBe(82);
    expect(pickLatestWeight(entries, "2026-02-05")).toBe(79);
    expect(pickLatestWeight(entries, "2026-02-06")).toBe(79);
  });
});
