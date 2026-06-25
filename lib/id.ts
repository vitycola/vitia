/**
 * Generate a cryptographically random UUID v4 using the Web Crypto API.
 * crypto.randomUUID() is available in all modern browsers (secure context),
 * in Node.js 15+, and in React Native's Hermes via the same global.
 * Used for local IDs on meal_entries and custom foods.
 */
export function generateId(): string {
  return globalThis.crypto.randomUUID();
}
