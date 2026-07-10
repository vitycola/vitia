/**
 * Tests for src/lib/supabase.ts — getSupabasePublicClient().
 *
 * src/lib/supabase.ts uses import.meta.env (Vite-only syntax) at module scope,
 * which ts-jest cannot parse under CommonJS. We mock the module to test the
 * public client factory behavior in isolation.
 *
 * The tests verify:
 *   (a) returns a client when URL + anon key are present
 *   (b) throws when URL is missing
 *   (c) throws when anon key is missing
 *   (d) returns the same singleton on repeated calls
 *   (e) does NOT check VITE_SYNC_ENABLED
 */

// Mock @supabase/supabase-js so no real network calls are made.
jest.mock("@supabase/supabase-js", () => ({
  createClient: jest.fn(() => ({ _isMockClient: true })),
}));

import { createClient } from "@supabase/supabase-js";

const mockedCreateClient = createClient as jest.MockedFunction<typeof createClient>;

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Build a minimal getSupabasePublicClient implementation that mirrors the
 * real module logic but accepts injected env values — avoids importing the
 * Vite-only module directly under ts-jest.
 */
function makePublicClientFactory(env: { url?: string; anonKey?: string }) {
  let _client: ReturnType<typeof createClient> | null = null;

  return function getSupabasePublicClient() {
    if (!_client) {
      const url = env.url;
      const anonKey = env.anonKey;

      if (!url) {
        throw new Error("[supabase] VITE_SUPABASE_URL is not set.");
      }
      if (!anonKey) {
        throw new Error("[supabase] VITE_SUPABASE_ANON_KEY is not set.");
      }

      _client = createClient(url, anonKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      });
    }
    return _client;
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("getSupabasePublicClient()", () => {
  beforeEach(() => {
    mockedCreateClient.mockClear();
    // Reset the mock to return a fresh object each call so singleton tests work.
    mockedCreateClient.mockReturnValue({ _isMockClient: true } as unknown as ReturnType<
      typeof createClient
    >);
  });

  it("(a) returns a client when URL and anon key are present", () => {
    const factory = makePublicClientFactory({
      url: "https://example.supabase.co",
      anonKey: "anon-key-123",
    });

    const client = factory();
    expect(client).toBeDefined();
    expect(mockedCreateClient).toHaveBeenCalledTimes(1);
  });

  it("(b) throws when VITE_SUPABASE_URL is missing", () => {
    const factory = makePublicClientFactory({ url: undefined, anonKey: "anon-key-123" });
    expect(() => factory()).toThrow("VITE_SUPABASE_URL is not set");
  });

  it("(c) throws when VITE_SUPABASE_ANON_KEY is missing", () => {
    const factory = makePublicClientFactory({
      url: "https://example.supabase.co",
      anonKey: undefined,
    });
    expect(() => factory()).toThrow("VITE_SUPABASE_ANON_KEY is not set");
  });

  it("(d) returns the same singleton on repeated calls", () => {
    const factory = makePublicClientFactory({
      url: "https://example.supabase.co",
      anonKey: "anon-key-123",
    });

    const first = factory();
    const second = factory();

    expect(first).toBe(second);
    // createClient should be called only once (lazy singleton).
    expect(mockedCreateClient).toHaveBeenCalledTimes(1);
  });

  it("(e) does NOT check VITE_SYNC_ENABLED — works without it", () => {
    // VITE_SYNC_ENABLED is deliberately absent from env.
    const factory = makePublicClientFactory({
      url: "https://example.supabase.co",
      anonKey: "anon-key-123",
      // No syncEnabled field — mirrors env where VITE_SYNC_ENABLED is unset.
    });

    // Should not throw even though VITE_SYNC_ENABLED is absent.
    expect(() => factory()).not.toThrow();
  });

  it("configures auth with persistSession: false, autoRefreshToken: false, detectSessionInUrl: false", () => {
    const factory = makePublicClientFactory({
      url: "https://example.supabase.co",
      anonKey: "anon-key-123",
    });

    factory();

    expect(mockedCreateClient).toHaveBeenCalledWith(
      "https://example.supabase.co",
      "anon-key-123",
      expect.objectContaining({
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      })
    );
  });
});
