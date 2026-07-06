/**
 * Isolated Vite env + location accessors for src/seed/seedDemoProfile.ts.
 *
 * `import.meta.env` is Vite-only syntax — any file containing that literal
 * token is a hard parse error under ts-jest/CommonJS (confirmed: it fails
 * even when the read is inside a function, not just at module scope; see
 * lib/openFoodFacts.ts and src/lib/supabase.ts for the same constraint).
 * Isolating the two reads here lets seedDemoProfile.test.ts fully mock this
 * module (mirrors the existing `jest.mock("@/src/lib/supabase", ...)`
 * pattern) instead of ever importing real `import.meta.env` syntax.
 */
export function getDemoSeedEnv(): {
  DEV: boolean;
  PROD: boolean;
  VITE_ENABLE_DEMO_SEED?: string;
} {
  return {
    DEV: import.meta.env.DEV,
    PROD: import.meta.env.PROD,
    VITE_ENABLE_DEMO_SEED: import.meta.env.VITE_ENABLE_DEMO_SEED,
  };
}

export function getHostname(): string {
  return location.hostname;
}

export function getLocationSearch(): string {
  return location.search;
}
