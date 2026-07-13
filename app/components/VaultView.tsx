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

interface SearchResult {
  itemId: number;
  title: string;
  url: string | null;
  snippet: string;
  score: number;
}

export default function VaultView() {
  const [items, setItems] = useState<Item[]>([]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [note, setNote] = useState("");

  const load = useCallback(() => {
    fetch("/api/items")
      .then((r) => r.json())
      .then((d) => setItems(d.items ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => load(), [load]);

  async function runSearch(q: string) {
    if (!q.trim()) {
      setResults(null);
      return;
    }
    try {
      const d = await (await fetch(`/api/search?q=${encodeURIComponent(q)}`)).json();
      setResults(d.results ?? []);
    } catch {
      setResults([]);
    }
  }

  async function reindex() {
    setNote("Reindexing…");
    try {
      const d = await (await fetch("/api/reindex", { method: "POST" })).json();
      setNote(
        d.error
          ? `Reindex error: ${d.error}`
          : `Reindexed — ${d.embedded} embedded${d.missing > d.embedded ? `, ${d.missing - d.embedded} pending (model not ready)` : ""}.`,
      );
    } catch (err) {
      setNote(`Reindex failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async function importVault() {
    setNote("Importing your Obsidian vault…");
    try {
      const d = await (await fetch("/api/import/vault", { method: "POST" })).json();
      setNote(
        d.error
          ? `Import error: ${d.error}`
          : `Imported ${d.imported} of ${d.scanned} notes${d.duplicates ? ` (${d.duplicates} already present)` : ""}.`,
      );
      load();
    } catch (err) {
      setNote(`Import failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return (
    <div className="view">
      <header className="viewhead">
        <h1>Vault</h1>
        <span>
          <button className="linkbtn" onClick={importVault}>
            Import Obsidian
          </button>
          {" · "}
          <button className="linkbtn" onClick={reindex}>
            Reindex
          </button>
        </span>
      </header>

      <Capture onSaved={load} onMessage={setNote} />

      <div className="addrow">
        <input
          value={query}
          placeholder="Search your vault…"
          onChange={(e) => {
            setQuery(e.target.value);
            runSearch(e.target.value);
          }}
        />
        {results !== null && (
          <button className="linkbtn" onClick={() => { setQuery(""); setResults(null); }}>
            clear
          </button>
        )}
      </div>

      {note && <p className="notice">{note}</p>}

      <div className="list">
        {results !== null ? (
          results.length === 0 ? (
            <p className="empty">No matches.</p>
          ) : (
            results.map((r) => (
              <div key={r.itemId} className="card">
                <div className="cardhead">
                  <strong>{r.title}</strong>
                  <span className="tag">{r.score}</span>
                </div>
                <p>{r.snippet}…</p>
                {r.url && (
                  <a href={r.url} target="_blank" rel="noreferrer">
                    source ↗
                  </a>
                )}
              </div>
            ))
          )
        ) : items.length === 0 ? (
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
