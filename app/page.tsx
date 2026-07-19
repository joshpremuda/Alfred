"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Sidebar from "./components/Sidebar";
import ChatView from "./components/ChatView";
import BriefView from "./components/BriefView";
import PaperFilterView from "./components/PaperFilterView";
import VaultView from "./components/VaultView";
import ProjectsView from "./components/ProjectsView";
import IdeasView from "./components/IdeasView";
import NotificationsView from "./components/NotificationsView";
import type { View, Theme } from "./components/types";

export default function Home() {
  const [view, setView] = useState<View>("chat");
  const [theme, setTheme] = useState<Theme>("light");
  const [unread, setUnread] = useState(0);
  const prevUnread = useRef(0);

  const refreshUnread = useCallback(() => {
    fetch("/api/notifications")
      .then((r) => r.json())
      .then((d) => {
        const n = d.unread ?? 0;
        // Fire a browser notification when new items appear (if permitted).
        if (n > prevUnread.current && typeof Notification !== "undefined" && Notification.permission === "granted") {
          new Notification(`Alfred has ${n} item${n === 1 ? "" : "s"} worth your attention.`);
        }
        prevUnread.current = n;
        setUnread(n);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const t = (localStorage.getItem("valet-theme") as Theme) || "light";
    setTheme(t);
    document.documentElement.dataset.theme = t;
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
    refreshUnread();
    const id = setInterval(refreshUnread, 30000);
    return () => clearInterval(id);
  }, [refreshUnread]);

  function pickTheme(t: Theme) {
    setTheme(t);
    document.documentElement.dataset.theme = t;
    localStorage.setItem("valet-theme", t);
  }

  return (
    <div className="shell">
      <Sidebar view={view} setView={setView} theme={theme} setTheme={pickTheme} unread={unread} />
      <main className="main">
        {view === "chat" && <ChatView />}
        {view === "brief" && <BriefView />}
        {view === "paper" && <PaperFilterView />}
        {view === "vault" && <VaultView />}
        {view === "projects" && <ProjectsView />}
        {view === "ideas" && <IdeasView />}
        {view === "notifications" && <NotificationsView onChange={refreshUnread} />}
      </main>
    </div>
  );
}
