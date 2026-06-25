/**
 * Tests for lib/id.ts — exercises the crypto.randomUUID() layer.
 * Layer: unit (no DB involved)
 * Spec: R7 — UUID v4 shape + uniqueness (Scenario 2.5)
 */

// Node 15+ has crypto.randomUUID natively; Jest test environment is "node",
// so no polyfill is needed.

import { generateId } from "@/lib/id";

const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe("generateId", () => {
  it("returns a string that matches the UUID v4 format", () => {
    const id = generateId();
    expect(typeof id).toBe("string");
    expect(UUID_V4_RE.test(id)).toBe(true);
  });

  it("returns unique values on consecutive calls (Scenario 2.5)", () => {
    const ids = Array.from({ length: 20 }, () => generateId());
    const unique = new Set(ids);
    expect(unique.size).toBe(20);
  });

  it("third character of the third group is always '4' (version nibble)", () => {
    for (let i = 0; i < 10; i++) {
      const id = generateId();
      // Format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
      expect(id[14]).toBe("4");
    }
  });

  it("variant bits of the fourth group are 8, 9, a, or b", () => {
    for (let i = 0; i < 10; i++) {
      const id = generateId();
      expect(["8", "9", "a", "b"]).toContain(id[19].toLowerCase());
    }
  });
});
