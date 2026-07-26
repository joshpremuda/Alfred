import { getDb } from "@/lib/db";
import { embed } from "@/lib/embeddings";
import { blobToVec, cosine } from "@/lib/vector";
import { createNotification } from "@/lib/notifications";

export interface Idea {
  id: number;
  name: string;
  notes: string | null;
  archived: number;
  created_at: string;
}

export function listIdeas(includeArchived = false): Idea[] {
  const q = includeArchived
    ? "SELECT * FROM ideas ORDER BY name"
    : "SELECT * FROM ideas WHERE archived = 0 ORDER BY name";
  return getDb().prepare(q).all() as Idea[];
}

export function addIdea(name: string, notes?: string): Idea {
  const db = getDb();
  db.prepare("INSERT OR IGNORE INTO ideas (name, notes) VALUES (?, ?)").run(name, notes ?? null);
  return db.prepare("SELECT * FROM ideas WHERE name = ?").get(name) as Idea;
}

export function archiveIdea(id: number): void {
  getDb().prepare("UPDATE ideas SET archived = 1 WHERE id = ?").run(id);
}

/**
 * Discover connections between recently captured items and the idea reservoir
 * using embedding similarity. Creates idea_links + notifications. Needs the
 * embedding model; returns 0 gracefully if it isn't available.
 */
export async function connectRecentItems(limit = 12): Promise<number> {
  const db = getDb();
  const ideas = listIdeas();
  if (!ideas.length) return 0;

  const ideaVecs: { id: number; name: string; v: Float32Array }[] = [];
  for (const idea of ideas) {
    try {
      ideaVecs.push({ id: idea.id, name: idea.name, v: await embed(`${idea.name} ${idea.notes ?? ""}`) });
    } catch {
      return 0; // model unavailable — skip quietly
    }
  }

  const items = db.prepare("SELECT id, title FROM items ORDER BY id DESC LIMIT ?").all(limit) as {
    id: number;
    title: string;
  }[];

  let created = 0;
  for (const item of items) {
    const chunks = db
      .prepare(
        "SELECT v.vec FROM chunk_vectors v JOIN chunks ch ON ch.id = v.chunk_id WHERE ch.item_id = ? LIMIT 1",
      )
      .get(item.id) as { vec: Buffer } | undefined;
    if (!chunks) continue;
    const iv = blobToVec(chunks.vec);

    let best = { id: 0, name: "", score: 0 };
    for (const cand of ideaVecs) {
      const s = cosine(iv, cand.v);
      if (s > best.score) best = { id: cand.id, name: cand.name, score: s };
    }
    if (best.score > 0.45) {
      const res = db
        .prepare("INSERT OR IGNORE INTO idea_links (idea_id, item_id, rationale) VALUES (?, ?, ?)")
        .run(best.id, item.id, `similarity ${best.score.toFixed(2)}`);
      if (res.changes > 0) {
        created++;
        createNotification(
          "connection",
          `New connection: ${best.name}`,
          `"${item.title}" may relate to your "${best.name}" idea.`,
          1,
        );
      }
    }
  }
  return created;
}
