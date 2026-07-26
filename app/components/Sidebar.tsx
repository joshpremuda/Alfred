"use client";

import type { View, Theme } from "./types";

const NAV: { key: View; label: string }[] = [
  { key: "chat", label: "Chat" },
  { key: "brief", label: "Brief me" },
  { key: "paper", label: "The Paper Filter" },
  { key: "vault", label: "Vault" },
  { key: "projects", label: "Projects" },
  { key: "ideas", label: "Ideas" },
  { key: "notifications", label: "Notifications" },
];

const THEMES: Theme[] = ["light", "dark", "sunny"];

export default function Sidebar({
  view,
  setView,
  theme,
  setTheme,
  unread,
}: {
  view: View;
  setView: (v: View) => void;
  theme: Theme;
  setTheme: (t: Theme) => void;
  unread: number;
}) {
  return (
    <aside className="sidebar">
      <div className="logo">
        Alfred
        <span>Valet</span>
      </div>

      <nav className="nav">
        {NAV.map((n) => (
          <button
            key={n.key}
            className={view === n.key ? "navitem active" : "navitem"}
            onClick={() => setView(n.key)}
          >
            <span>{n.label}</span>
            {n.key === "notifications" && unread > 0 ? <em className="badge">{unread}</em> : null}
          </button>
        ))}
      </nav>

      <div className="themes sidebar-themes">
        {THEMES.map((t) => (
          <button key={t} aria-pressed={theme === t} onClick={() => setTheme(t)}>
            {t[0].toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>
    </aside>
  );
}
