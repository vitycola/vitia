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
      <nav className="sticky bottom-0 z-10 flex border-t border-gray-200 bg-white">
        <NavLink
          to="/"
          end
          className={({ isActive }) =>
            `flex flex-1 flex-col items-center gap-1 py-2 text-xs font-medium ${
              isActive ? "text-green-600" : "text-gray-400"
            }`
          }
        >
          <Home size={22} />
          <span>Día</span>
        </NavLink>

        <NavLink
          to="/search"
          className={({ isActive }) =>
            `flex flex-1 flex-col items-center gap-1 py-2 text-xs font-medium ${
              isActive ? "text-green-600" : "text-gray-400"
            }`
          }
        >
          <Search size={22} />
          <span>Buscar</span>
        </NavLink>

        <NavLink
          to="/profile"
          className={({ isActive }) =>
            `flex flex-1 flex-col items-center gap-1 py-2 text-xs font-medium ${
              isActive ? "text-green-600" : "text-gray-400"
            }`
          }
        >
          <User size={22} />
          <span>Perfil</span>
        </NavLink>
      </nav>
    </div>
  );
}
