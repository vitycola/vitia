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

// jsdom (used per-file via `@jest-environment jsdom` docblocks for component
// tests) does not expose TextEncoder/TextDecoder in this Jest/jsdom version,
// but react-router-dom's ESM build requires them at import time. Polyfill
// from Node's util module only when missing — no-op in the node environment.
import { TextDecoder, TextEncoder } from "node:util";

if (typeof globalThis.TextEncoder === "undefined") {
  Object.defineProperty(globalThis, "TextEncoder", {
    value: TextEncoder,
    writable: true,
    configurable: true,
  });
}

if (typeof globalThis.TextDecoder === "undefined") {
  Object.defineProperty(globalThis, "TextDecoder", {
    value: TextDecoder,
    writable: true,
    configurable: true,
  });
}
