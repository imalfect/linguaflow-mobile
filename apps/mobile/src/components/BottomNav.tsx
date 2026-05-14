import { Home, BookOpen, User } from "lucide-react";
import { NavLink } from "react-router-dom";

const TABS = [
  { to: "/app/home", label: "Start", icon: Home },
  { to: "/app/modules", label: "Moduły", icon: BookOpen },
  { to: "/app/profile", label: "Profil", icon: User },
] as const;

export function BottomNav() {
  return (
    <div
      className="fixed bottom-0 inset-x-0 bg-surface_low border-t border-surface_high pb-safe"
      style={{ paddingBottom: "max(env(safe-area-inset-bottom), 0.5rem)" }}
    >
      <nav className="mx-auto max-w-md flex justify-around items-stretch py-2">
        {TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={({ isActive }) =>
              [
                "flex-1 flex flex-col items-center justify-center py-1.5 gap-1 text-xs font-medium transition-colors",
                isActive ? "text-primary" : "text-muted",
              ].join(" ")
            }
          >
            <tab.icon size={22} />
            <span>{tab.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
