import { OFF_SEED_NAMESPACE, offProductId, uuidV5 } from "../offId";

describe("uuidV5", () => {
  it("matches the RFC 4122 reference vector (DNS namespace, python.org)", () => {
    expect(uuidV5("python.org", "6ba7b810-9dad-11d1-80b4-00c04fd430c8")).toBe(
      "886313e1-3b8a-5372-9b90-0c9aee199e5d"
    );
  });
  it("is deterministic and version 5", () => {
    const a = offProductId("8480000050076");
    expect(a).toBe(offProductId("8480000050076"));
    expect(a).not.toBe(offProductId("8480000050090"));
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
  it("namespace constant is a valid UUID", () => {
    expect(OFF_SEED_NAMESPACE).toMatch(/^[0-9a-f-]{36}$/);
  });
});
