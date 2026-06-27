/**
 * Auth store — mirrors Supabase session state into Zustand.
 *
 * Design: sdd/user-session-persistence/design — Architecture Decisions 3 & 4
 *   - Mirrors onAuthStateChange so repos can read userId synchronously
 *   - Exposes userId, status, and auth actions
 *
 * When VITE_SYNC_ENABLED is not "true", this store stays in 'anon' status
 * and userId remains null — the app behaves as a fully local-only PWA.
 */

import { isSyncEnabled, getSupabaseClient } from "@/src/lib/supabase";
import { create } from "zustand";

// ── Auth status ────────────────────────────────────────────────────────
export type AuthStatus = "loading" | "authed" | "anon";

// ── Store shape ────────────────────────────────────────────────────────
interface AuthState {
  userId: string | null;
  status: AuthStatus;
}

interface AuthActions {
  /** Hydrate auth state from the current Supabase session (call at boot). */
  initFromSession(): Promise<void>;
  /** Sign in with Google OAuth via full-page redirect. */
  signInWithGoogle(): Promise<void>;
  /** Sign in with email and password. */
  signInWithPassword(email: string, password: string): Promise<{ error: string | null }>;
  /** Register a new account with email and password. */
  signUp(email: string, password: string): Promise<{ error: string | null }>;
  /** Sign out and clear the session. */
  signOut(): Promise<void>;
}

export const useAuthStore = create<AuthState & AuthActions>()((set) => ({
  // ── Initial state ──────────────────────────────────────────────────
  userId: null,
  status: "loading",

  // ── Actions ────────────────────────────────────────────────────────
  initFromSession: async () => {
    if (!isSyncEnabled()) {
      // Sync disabled — run in anonymous local-only mode
      set({ userId: null, status: "anon" });
      return;
    }

    try {
      const supabase = getSupabaseClient();

      // Restore session from storage / URL fragment after OAuth redirect
      const {
        data: { session },
      } = await supabase.auth.getSession();

      set({
        userId: session?.user.id ?? null,
        status: session ? "authed" : "anon",
      });

      // Subscribe to future auth state changes (token refresh, sign out, etc.)
      supabase.auth.onAuthStateChange((_event, session) => {
        set({
          userId: session?.user.id ?? null,
          status: session ? "authed" : "anon",
        });
      });
    } catch (err) {
      console.error("[authStore] initFromSession failed:", err);
      set({ userId: null, status: "anon" });
    }
  },

  signInWithGoogle: async () => {
    if (!isSyncEnabled()) return;

    const supabase = getSupabaseClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        // Full-page redirect — required under COOP: same-origin (no popup)
        skipBrowserRedirect: false,
        redirectTo: window.location.origin,
      },
    });

    if (error) {
      console.error("[authStore] signInWithGoogle failed:", error.message);
    }
    // Navigation is handled by the OAuth redirect; store updates via onAuthStateChange
  },

  signInWithPassword: async (email, password) => {
    if (!isSyncEnabled()) return { error: "Cloud sync is disabled." };

    const supabase = getSupabaseClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      console.error("[authStore] signInWithPassword failed:", error.message);
      return { error: error.message };
    }
    // Store updates via onAuthStateChange
    return { error: null };
  },

  signUp: async (email, password) => {
    if (!isSyncEnabled()) return { error: "Cloud sync is disabled." };

    const supabase = getSupabaseClient();
    const { error } = await supabase.auth.signUp({ email, password });

    if (error) {
      console.error("[authStore] signUp failed:", error.message);
      return { error: error.message };
    }
    // Store updates via onAuthStateChange once email is confirmed
    return { error: null };
  },

  signOut: async () => {
    if (!isSyncEnabled()) {
      set({ userId: null, status: "anon" });
      return;
    }

    const supabase = getSupabaseClient();
    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error("[authStore] signOut failed:", error.message);
    }
    // Store updates via onAuthStateChange
  },
}));
