import { NavLink } from "react-router-dom";

export interface RouteTabItem {
  to: string;
  label: string;
  /** Passed through to NavLink's `end` prop for exact-match active state. */
  end?: boolean;
}

interface RouteTabsProps {
  items: RouteTabItem[];
}

/**
 * Route-driven tab bar. Active state comes from the current route match
 * (via NavLink), not local component state — so deep links and browser
 * back/forward keep the tab bar in sync.
 *
 * Generalized from the accent-underline style in SearchTabs.
 */
export function RouteTabs({ items }: RouteTabsProps) {
  return (
    <div className="flex flex-row overflow-x-auto">
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          className={({ isActive }) =>
            [
              "flex flex-1 flex-col items-center gap-1 py-2 px-1 text-xs font-medium whitespace-nowrap min-w-[4.5rem] transition-colors",
              isActive
                ? "border-b-2 border-accent text-accent"
                : "border-b-2 border-transparent text-gray-400",
            ].join(" ")
          }
        >
          {item.label}
        </NavLink>
      ))}
    </div>
  );
}
