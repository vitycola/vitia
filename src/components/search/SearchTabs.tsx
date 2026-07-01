export type SearchTabId = "database" | "favorites" | "created" | "ai";

interface Tab {
  id: SearchTabId;
  label: string;
  icon: string;
}

const TABS: Tab[] = [
  { id: "database", label: "Base de Datos", icon: "🍽️" },
  { id: "favorites", label: "Favoritos", icon: "❤️" },
  { id: "created", label: "Creados", icon: "✏️" },
  { id: "ai", label: "Añadir con IA", icon: "✨" },
];

interface SearchTabsProps {
  active: SearchTabId;
  onChange: (id: SearchTabId) => void;
}

export function SearchTabs({ active, onChange }: SearchTabsProps) {
  return (
    <div className="flex flex-row overflow-x-auto">
      {TABS.map((tab) => {
        const isActive = tab.id === active;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={[
              "flex flex-1 flex-col items-center gap-1 py-2 px-1 text-xs font-medium whitespace-nowrap min-w-[4.5rem] transition-colors",
              isActive
                ? "border-b-2 border-accent text-accent"
                : "border-b-2 border-transparent text-gray-400",
            ].join(" ")}
          >
            <span className="text-base leading-none">{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}
