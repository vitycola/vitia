/**
 * Jest global setup — polyfills for the Node 18 test environment.
 *
 * globalThis.crypto is available in Node 18 but its randomUUID() may not be
 * exposed in the Jest VM context. We patch it here using the native webcrypto
 * module so lib/id.ts (and any code that calls crypto.randomUUID()) works in
 * all test runs without modifying the runtime source.
 */
import { webcrypto } from "node:crypto";

if (!globalThis.crypto?.randomUUID) {
  Object.defineProperty(globalThis, "crypto", {
    value: webcrypto,
    writable: true,
    configurable: true,
  });
}

// Register fake-indexeddb so Dexie works in Node/Jest test environment.
// This must run before any Dexie database is opened.
import "fake-indexeddb/auto";
