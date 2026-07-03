import { RouteTabs } from "@/src/components/ui/RouteTabs";
import { useProfileStore } from "@/stores/useProfileStore";
import { useEffect, useRef } from "react";
import { Outlet, useNavigate } from "react-router-dom";

const PROFILE_TABS = [
  { to: "/profile", label: "Configuración", end: true },
  { to: "/profile/plan", label: "Plan" },
  { to: "/profile/progress", label: "Progreso" },
];

/**
 * Host layout for the /profile section. Owns the load/hasProfile redirect
 * guard (ported from the former flat ProfileRoute) so all three children
 * share it once, and renders the route-driven tab bar + nested Outlet.
 */
export function ProfileLayout() {
  const navigate = useNavigate();
  const { profile, hasProfile, load } = useProfileStore();
  const loadAttempted = useRef(false);

  useEffect(() => {
    if (!loadAttempted.current) {
      loadAttempted.current = true;
      void load();
    }
  }, [load]);

  useEffect(() => {
    if (loadAttempted.current && !hasProfile) {
      void navigate("/onboarding", { replace: true });
    }
  }, [hasProfile, navigate]);

  if (!profile) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-gray-400">Cargando perfil…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      <div className="bg-white px-4 pb-2 pt-5 shadow-sm">
        <h1 className="mb-3 text-xl font-bold text-gray-900">Perfil</h1>
        <RouteTabs items={PROFILE_TABS} />
      </div>

      <div className="px-4 pt-4">
        <Outlet />
      </div>
    </div>
  );
}
