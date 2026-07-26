"use client";

import { useCallback, useEffect, useState } from "react";

interface Idea {
  id: number;
  name: string;
  notes: string | null;
}

export default function IdeasView() {
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [name, setName] = useState("");

  const load = useCallback(() => {
    fetch("/api/ideas")
      .then((r) => r.json())
      .then((d) => setIdeas(d.ideas ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => load(), [load]);

  async function add() {
    if (!name.trim()) return;
    await fetch("/api/ideas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim() }),
    });
    setName("");
    load();
  }

  return (
    <div className="view">
      <header className="viewhead">
        <h1>Idea Reservoir</h1>
        <span>{ideas.length} ideas</span>
      </header>

      <div className="addrow">
        <input
          value={name}
          placeholder="New idea… (it never disappears)"
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") add();
          }}
        />
        <button onClick={add} disabled={!name.trim()}>
          Add
        </button>
      </div>

      <div className="ideagrid">
        {ideas.map((i) => (
          <div key={i.id} className="idea">
            {i.name}
          </div>
        ))}
      </div>
    </div>
  );
}
