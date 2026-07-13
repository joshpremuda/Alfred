"use client";

import { useCallback, useEffect, useState } from "react";

interface Project {
  id: number;
  name: string;
  status: "active" | "stalled" | "done" | "someday";
  notes: string | null;
  next_action: string | null;
  last_activity_at: string;
}

const STATUSES: Project["status"][] = ["active", "stalled", "done", "someday"];

export default function ProjectsView() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [name, setName] = useState("");
  const [next, setNext] = useState("");

  const load = useCallback(() => {
    fetch("/api/projects")
      .then((r) => r.json())
      .then((d) => setProjects(d.projects ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => load(), [load]);

  async function save(body: Record<string, unknown>) {
    await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    load();
  }

  async function add() {
    if (!name.trim()) return;
    await save({ name: name.trim(), next_action: next.trim() || undefined });
    setName("");
    setNext("");
  }

  return (
    <div className="view">
      <header className="viewhead">
        <h1>Projects</h1>
        <span>{projects.filter((p) => p.status === "active").length} active</span>
      </header>

      <div className="addrow">
        <input value={name} placeholder="New project…" onChange={(e) => setName(e.target.value)} />
        <input value={next} placeholder="Next action (optional)" onChange={(e) => setNext(e.target.value)} />
        <button onClick={add} disabled={!name.trim()}>
          Add
        </button>
      </div>

      <div className="list">
        {projects.length === 0 ? (
          <p className="empty">No projects yet.</p>
        ) : (
          projects.map((p) => (
            <div key={p.id} className="card">
              <div className="cardhead">
                <strong>{p.name}</strong>
                <select
                  className={`status status-${p.status}`}
                  value={p.status}
                  onChange={(e) => save({ name: p.name, status: e.target.value })}
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              {p.next_action && (
                <p>
                  <span className="muted">Next:</span> {p.next_action}
                </p>
              )}
              {p.notes && <p>{p.notes}</p>}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
