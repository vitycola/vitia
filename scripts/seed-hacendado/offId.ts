/**
 * Deterministic row ids for the Open Food Facts seed.
 *
 * id = UUIDv5(OFF_SEED_NAMESPACE, "off:" + <OFF barcode>). Re-running the
 * pipeline therefore yields the same id for the same product, so the generated
 * `insert ... on conflict (id) do update` files upsert instead of duplicating.
 *
 * OFF_SEED_NAMESPACE is an arbitrary, fixed UUID generated once for this
 * project. NEVER change it: doing so would orphan every previously seeded row.
 */

import { createHash } from "node:crypto";

export const OFF_SEED_NAMESPACE = "3b0f6d1e-5a42-4c8e-9d27-7e1c94a0b5f3";

function uuidToBytes(uuid: string): Buffer {
  return Buffer.from(uuid.replace(/-/g, ""), "hex");
}

/** RFC 4122 UUID version 5 (SHA-1, name-based). */
export function uuidV5(name: string, namespace: string = OFF_SEED_NAMESPACE): string {
  const hash = createHash("sha1")
    .update(uuidToBytes(namespace))
    .update(Buffer.from(name, "utf8"))
    .digest();
  const bytes = Buffer.from(hash.subarray(0, 16));
  bytes[6] = (bytes[6] & 0x0f) | 0x50; // version 5
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // RFC 4122 variant
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function offProductId(code: string): string {
  return uuidV5(`off:${code}`);
}
