"use client";

import { useCallback, useEffect, useState } from "react";
import Capture from "./Capture";

interface Item {
  id: number;
  type: string;
  title: string;
  url: string | null;
  summary: string | null;
  collections: string[];
  created_at: string;
}

export default function VaultView() {
  const [items, setItems] = useState<Item[]>([]);

  const load = useCallback(() => {
    fetch("/api/items")
      .then((r) => r.json())
      .then((d) => setItems(d.items ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => load(), [load]);

  return (
    <div className="view">
      <header className="viewhead">
        <h1>Vault</h1>
        <span>{items.length} items</span>
      </header>
      <Capture onSaved={load} />
      <div className="list">
        {items.length === 0 ? (
          <p className="empty">Nothing captured yet. Paste a URL or type a note above.</p>
        ) : (
          items.map((it) => (
            <div key={it.id} className="card">
              <div className="cardhead">
                <strong>{it.title}</strong>
                <span className="tag">{it.type}</span>
              </div>
              {it.summary && <p>{it.summary}</p>}
              <div className="meta">
                {it.collections.map((c) => (
                  <em key={c} className="chip">
                    {c}
                  </em>
                ))}
                {it.url && (
                  <a href={it.url} target="_blank" rel="noreferrer">
                    source ↗
                  </a>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
