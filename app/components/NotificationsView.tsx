"use client";

import { useCallback, useEffect, useState } from "react";

interface Notification {
  id: number;
  kind: string;
  title: string;
  body: string | null;
  importance: number;
  read_at: string | null;
}

export default function NotificationsView({ onChange }: { onChange?: () => void }) {
  const [items, setItems] = useState<Notification[]>([]);

  const load = useCallback(() => {
    fetch("/api/notifications?all=1")
      .then((r) => r.json())
      .then((d) => setItems(d.notifications ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => load(), [load]);

  async function mark(body: Record<string, unknown>) {
    await fetch("/api/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    load();
    onChange?.();
  }

  const unread = items.filter((n) => !n.read_at);

  return (
    <div className="view">
      <header className="viewhead">
        <h1>Notifications</h1>
        {unread.length > 0 ? (
          <button className="linkbtn" onClick={() => mark({ all: true })}>
            Mark all read
          </button>
        ) : (
          <span>All clear</span>
        )}
      </header>

      <div className="list">
        {items.length === 0 ? (
          <p className="empty">Nothing needs your attention. Alfred stays quiet on purpose.</p>
        ) : (
          items.map((n) => (
            <div key={n.id} className={n.read_at ? "card read" : "card"}>
              <div className="cardhead">
                <strong>{n.title}</strong>
                {!n.read_at && (
                  <button className="linkbtn" onClick={() => mark({ id: n.id })}>
                    dismiss
                  </button>
                )}
              </div>
              {n.body && <p>{n.body}</p>}
              <span className="tag">{n.kind}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
