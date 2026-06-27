import { Home, Search, User } from "lucide-react";
import { NavLink, Outlet } from "react-router-dom";

export function TabLayout() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Main content */}
      <div className="flex-1 overflow-auto">
        <Outlet />
      </div>

      {/* Bottom tab bar */}
      <nav className="sticky bottom-0 z-10 flex bg-surface px-2 py-1">
        <NavLink
          to="/"
          end
          className="flex flex-1 flex-col items-center"
        >
          {({ isActive }) => (
            <span className={`flex flex-col items-center gap-1 rounded-2xl px-4 py-2 text-xs font-medium ${isActive ? "bg-[#E5E5EA] text-[#1C1C1E]" : "text-[#8E8E93]"}`}>
              <Home size={22} />
              Día
            </span>
          )}
        </NavLink>

        <NavLink
          to="/search"
          className="flex flex-1 flex-col items-center"
        >
          {({ isActive }) => (
            <span className={`flex flex-col items-center gap-1 rounded-2xl px-4 py-2 text-xs font-medium ${isActive ? "bg-[#E5E5EA] text-[#1C1C1E]" : "text-[#8E8E93]"}`}>
              <Search size={22} />
              Buscar
            </span>
          )}
        </NavLink>

        <NavLink
          to="/profile"
          className="flex flex-1 flex-col items-center"
        >
          {({ isActive }) => (
            <span className={`flex flex-col items-center gap-1 rounded-2xl px-4 py-2 text-xs font-medium ${isActive ? "bg-[#E5E5EA] text-[#1C1C1E]" : "text-[#8E8E93]"}`}>
              <User size={22} />
              Perfil
            </span>
          )}
        </NavLink>
      </nav>
    </div>
  );
}
