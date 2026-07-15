/**
 * Supabase client singleton.
 *
 * Created lazily — only when VITE_SYNC_ENABLED=true.
 * Call getSupabaseClient() to obtain the instance; it throws when the
 * feature flag is off so callers can guard with VITE_SYNC_ENABLED checks.
 *
 * Design: sdd/user-session-persistence/design — Architecture Decision 1
 */

import { type SupabaseClient, createClient } from "@supabase/supabase-js";

let _client: SupabaseClient | null = null;

/**
 * Returns the Supabase client singleton.
 * Throws if VITE_SYNC_ENABLED is not "true" (rollback / local-only mode).
 */
export function getSupabaseClient(): SupabaseClient {
  if (import.meta.env.VITE_SYNC_ENABLED !== "true") {
    throw new Error("[supabase] VITE_SYNC_ENABLED is not set to true. Cloud sync is disabled.");
  }

  if (!_client) {
    const url = import.meta.env.VITE_SUPABASE_URL;
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    if (!url || !anonKey) {
      throw new Error(
        "[supabase] VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set when VITE_SYNC_ENABLED=true."
      );
    }

    _client = createClient(url, anonKey, {
      auth: {
        // Automatically detect session from the URL after OAuth redirect
        detectSessionInUrl: true,
        // Persist session in localStorage across browser restarts
        persistSession: true,
        autoRefreshToken: true,
      },
    });
  }

  return _client;
}

/**
 * Returns true when cloud sync is enabled via the feature flag.
 * Use this to guard enqueue / sync calls without catching thrown errors.
 */
export function isSyncEnabled(): boolean {
  return import.meta.env.VITE_SYNC_ENABLED === "true";
}

// ── Public read-only client (catalog access) ───────────────────────────────
//
// Intentionally separate from getSupabaseClient(). This client is used for
// read-only catalog queries (e.g. generic_foods) and does NOT check
// VITE_SYNC_ENABLED — catalog access must work even when sync is disabled.
// No session persistence or auth token refresh needed for public SELECT.

let _publicClient: SupabaseClient | null = null;

/**
 * Returns a Supabase client configured for read-only catalog access.
 * Does NOT check VITE_SYNC_ENABLED — catalog reads are always available.
 * Throws if VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY are missing.
 */
export function getSupabasePublicClient(): SupabaseClient {
  if (!_publicClient) {
    const url = import.meta.env.VITE_SUPABASE_URL;
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    if (!url) {
      throw new Error("[supabase] VITE_SUPABASE_URL is not set.");
    }
    if (!anonKey) {
      throw new Error("[supabase] VITE_SUPABASE_ANON_KEY is not set.");
    }

    _publicClient = createClient(url, anonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
  }

  return _publicClient;
}

// ── Auth-aware client (session reading, no sync dependency) ────────────────
//
// Used by services that need the user's JWT (e.g. vitia-ia requests) but
// cannot depend on VITE_SYNC_ENABLED. persistSession: true so it can read
// the session stored in localStorage by the main auth client.

let _authClient: SupabaseClient | null = null;

export function getSupabaseAuthClient(): SupabaseClient {
  if (!_authClient) {
    const url = import.meta.env.VITE_SUPABASE_URL;
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    if (!url || !anonKey) return getSupabasePublicClient();

    _authClient = createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    });
  }

  return _authClient;
}
