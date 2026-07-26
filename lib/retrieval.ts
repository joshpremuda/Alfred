import { getDb } from "@/lib/db";
import { embed } from "@/lib/embeddings";
import { blobToVec, cosine } from "@/lib/vector";

export { cosine };

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

/** Semantic search via embeddings. Throws if the model is unavailable. */
export async function vectorSearch(query: string, k = 5): Promise<Hit[]> {
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

/** Build a safe FTS5 MATCH query (prefix-matched OR of alphanumeric tokens). */
export function ftsQuery(query: string): string {
  const tokens = query
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1);
  return tokens.map((t) => `"${t}"*`).join(" OR ");
}

/** Keyword search via FTS5. Works with no embeddings; never throws. */
export function keywordSearch(query: string, k = 5): Hit[] {
  const match = ftsQuery(query);
  if (!match) return [];
  try {
    const rows = getDb()
      .prepare(
        `SELECT ch.item_id, it.title, it.url, ch.content, bm25(chunks_fts) AS rank
           FROM chunks_fts
           JOIN chunks ch ON ch.id = chunks_fts.rowid
           JOIN items  it ON it.id = ch.item_id
          WHERE chunks_fts MATCH ?
          ORDER BY rank
          LIMIT ?`,
      )
      .all(match, k) as (Omit<Hit, "score" | "itemId"> & { item_id: number; rank: number })[];
    // A FTS MATCH guarantees a literal token hit, but bm25 is ~0 on tiny
    // corpora. Score by rank position so real matches clear the chat threshold
    // and keep their order.
    return rows.map((r, idx) => ({
      itemId: r.item_id,
      title: r.title,
      url: r.url,
      content: r.content,
      score: Math.max(0.3, 0.6 - idx * 0.05),
    }));
  } catch {
    return [];
  }
}

/** Hybrid search: semantic when available, always merged with keyword hits. */
export async function search(query: string, k = 5): Promise<Hit[]> {
  let vectorHits: Hit[] = [];
  try {
    vectorHits = await vectorSearch(query, k);
  } catch {
    /* embedding model unavailable — keyword-only */
  }
  const keywordHits = keywordSearch(query, k);

  // Merge, keeping the best score per (item, content) chunk.
  const byKey = new Map<string, Hit>();
  for (const h of [...vectorHits, ...keywordHits]) {
    const key = `${h.itemId}:${h.content.slice(0, 64)}`;
    const prev = byKey.get(key);
    if (!prev || h.score > prev.score) byKey.set(key, h);
  }
  return [...byKey.values()].sort((a, b) => b.score - a.score).slice(0, k);
}

/** Item-level search results (deduped by item) for the Vault view. */
export async function searchItems(query: string, k = 8) {
  const hits = await search(query, k * 2);
  const byItem = new Map<number, Hit>();
  for (const h of hits) {
    const prev = byItem.get(h.itemId);
    if (!prev || h.score > prev.score) byItem.set(h.itemId, h);
  }
  return [...byItem.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, k)
    .map((h) => ({
      itemId: h.itemId,
      title: h.title,
      url: h.url,
      snippet: h.content.slice(0, 220),
      score: Number(h.score.toFixed(3)),
    }));
}

/** Format hits as a compact, citable context block for Claude. */
export function assembleContext(hits: Hit[]): string {
  return hits
    .map((h, i) => `[${i + 1}] ${h.title}${h.url ? ` — ${h.url}` : ""}\n${h.content}`)
    .join("\n\n");
}
