/**
 * Login/Register screen.
 *
 * Spec: sdd/user-session-persistence/spec — user-auth domain
 *   - Email/password registration and login (tabs)
 *   - Google OAuth via full-page redirect (COOP-safe, no popup)
 */

import { useAuthStore } from "@/src/stores/useAuthStore";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

type Tab = "login" | "register";

export function LoginRoute() {
  const navigate = useNavigate();
  const { signInWithGoogle, signInWithPassword, signUp, status } = useAuthStore();
  const [tab, setTab] = useState<Tab>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // If already authenticated, go to app
  if (status === "authed") {
    void navigate("/", { replace: true });
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      if (tab === "login") {
        const result = await signInWithPassword(email, password);
        if (result.error) {
          setError(result.error);
          return;
        }
        void navigate("/", { replace: true });
      } else {
        const result = await signUp(email, password);
        if (result.error) {
          setError(result.error);
          return;
        }
        // Supabase may require email confirmation; show a message
        setError("Check your email to confirm your account before logging in.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        <h1 className="mb-6 text-center text-2xl font-bold text-gray-900">Vitia</h1>

        {/* Tabs */}
        <div className="mb-6 flex rounded-xl border border-gray-200 bg-white p-1">
          <button
            type="button"
            onClick={() => {
              setTab("login");
              setError(null);
            }}
            className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${
              tab === "login" ? "bg-green-600 text-white" : "text-gray-500 hover:text-gray-900"
            }`}
          >
            Sign in
          </button>
          <button
            type="button"
            onClick={() => {
              setTab("register");
              setError(null);
            }}
            className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${
              tab === "register" ? "bg-green-600 text-white" : "text-gray-500 hover:text-gray-900"
            }`}
          >
            Create account
          </button>
        </div>

        {/* Email/password form */}
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-3">
          <div>
            <label htmlFor="email" className="mb-1 block text-sm font-medium text-gray-700">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none transition-colors focus:border-green-500 focus:ring-2 focus:ring-green-500/20"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="mb-1 block text-sm font-medium text-gray-700">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete={tab === "login" ? "current-password" : "new-password"}
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 outline-none transition-colors focus:border-green-500 focus:ring-2 focus:ring-green-500/20"
              placeholder="At least 8 characters"
            />
          </div>

          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-1 flex w-full items-center justify-center rounded-xl bg-green-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-green-700 disabled:opacity-50"
          >
            {isSubmitting ? "Please wait…" : tab === "login" ? "Sign in" : "Create account"}
          </button>
        </form>
      </div>
    </div>
  );
}
