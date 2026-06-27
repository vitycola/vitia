/**
 * AuthGuard — route wrapper that enforces authentication.
 *
 * Spec: sdd/user-session-persistence/spec — user-auth: Unauthenticated Redirect
 *   - loading → spinner
 *   - anon    → redirect to /login
 *   - authed  → render children
 *
 * When VITE_SYNC_ENABLED is not "true", the auth store stays in 'anon' mode
 * but we skip the redirect so local-only mode works without an account.
 */

import { useAuthStore } from "@/src/stores/useAuthStore";
import { isSyncEnabled } from "@/src/lib/supabase";
import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";

interface AuthGuardProps {
  children: ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const status = useAuthStore((s) => s.status);

  // When sync is disabled, always render children (local-only mode)
  if (!isSyncEnabled()) {
    return <>{children}</>;
  }

  if (status === "loading") {
    return (
      <div
        className="flex min-h-screen items-center justify-center"
        role="status"
        aria-label="Loading"
      >
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-green-600 border-t-transparent" />
      </div>
    );
  }

  if (status === "anon") {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
