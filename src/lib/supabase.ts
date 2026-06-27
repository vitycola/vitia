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
