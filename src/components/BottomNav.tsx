import { NavLink } from "react-router-dom";

const TABS = [
  { to: "/", label: "ホーム", icon: "🏠" },
  { to: "/trends", label: "推移", icon: "📈" },
  { to: "/settings", label: "設定", icon: "⚙️" },
];

export default function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-20 border-t border-black/5 bg-background/95 backdrop-blur">
      <ul className="mx-auto flex max-w-md items-center justify-around px-2 py-2">
        {TABS.map((tab) => (
          <li key={tab.to}>
            <NavLink
              to={tab.to}
              end={tab.to === "/"}
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 rounded-full px-4 py-1.5 text-xs transition-colors ${
                  isActive ? "bg-primary/10 text-primary" : "text-muted"
                }`
              }
            >
              <span className="text-lg leading-none">{tab.icon}</span>
              <span className="font-medium">{tab.label}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
