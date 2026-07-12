import { getDb } from "@/lib/db";
import { embed, blobToVec } from "@/lib/embeddings";

export interface Hit {
  itemId: number;
  title: string;
  url: string | null;
  content: string;
  score: number;
}

interface VectorRow {
  item_id: number;
  title: string;
  url: string | null;
  content: string;
  vec: Buffer;
}

/** Cosine similarity between two equal-length vectors. */
export function cosine(a: Float32Array, b: Float32Array): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return na && nb ? dot / (Math.sqrt(na) * Math.sqrt(nb)) : 0;
}

/** Rank stored chunk rows against a query vector (pure — unit-testable). */
export function topKByVector(query: Float32Array, rows: VectorRow[], k: number): Hit[] {
  return rows
    .map((r) => ({
      itemId: r.item_id,
      title: r.title,
      url: r.url,
      content: r.content,
      score: cosine(query, blobToVec(r.vec)),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}

/** Semantic search over all captured chunks. */
export async function search(query: string, k = 5): Promise<Hit[]> {
  const rows = getDb()
    .prepare(
      `SELECT ch.item_id, it.title, it.url, ch.content, v.vec
         FROM chunk_vectors v
         JOIN chunks ch ON ch.id = v.chunk_id
         JOIN items  it ON it.id = ch.item_id`,
    )
    .all() as VectorRow[];
  if (rows.length === 0) return [];
  const q = await embed(query);
  return topKByVector(q, rows, k);
}

/** Format hits as a compact, citable context block for Claude. */
export function assembleContext(hits: Hit[]): string {
  return hits
    .map((h, i) => `[${i + 1}] ${h.title}${h.url ? ` — ${h.url}` : ""}\n${h.content}`)
    .join("\n\n");
}
