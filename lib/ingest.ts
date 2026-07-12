import { createHash } from "node:crypto";
import { getDb } from "@/lib/db";
import { chunkText } from "@/lib/chunk";
import { embed, vecToBlob } from "@/lib/embeddings";
import { writeNote, slugify } from "@/lib/vault";
import { summarizeClassify } from "@/lib/claude";

export interface IngestInput {
  type: "url" | "file" | "note";
  text: string;
  title?: string;
  url?: string;
  source?: string;
  filePath?: string;
}

export interface IngestResult {
  id: number;
  status: "created" | "duplicate";
  title: string;
  collections: string[];
  chunks: number;
  embedded: boolean;
  note?: string;
}

export async function ingestItem(input: IngestInput): Promise<IngestResult> {
  const db = getDb();
  const hash = createHash("sha256")
    .update(`${input.url ?? ""}\n${input.text}`)
    .digest("hex");

  const existing = db
    .prepare("SELECT id, title FROM items WHERE content_hash = ?")
    .get(hash) as { id: number; title: string } | undefined;
  if (existing) {
    return {
      id: existing.id,
      status: "duplicate",
      title: existing.title,
      collections: collectionsFor(existing.id),
      chunks: 0,
      embedded: false,
    };
  }

  // Optional enrichment — skipped gracefully when no API key is set.
  const enrich = await summarizeClassify(input.text, input.title);
  const title = input.title?.trim() || enrich?.title?.trim() || input.url || "Untitled note";
  const summary = enrich?.summary?.trim() || input.text.slice(0, 280);
  const collections = enrich?.collections ?? [];

  const info = db
    .prepare(
      `INSERT INTO items (type, title, url, source, file_path, content_hash, text_summary, ingested_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
    )
    .run(
      input.type,
      title,
      input.url ?? null,
      input.source ?? "manual",
      input.filePath ?? null,
      hash,
      summary,
    );
  const itemId = Number(info.lastInsertRowid);

  // Chunk, then embed each chunk. Chunks are stored even if embedding fails
  // (e.g. model not yet downloaded) so capture is never lost — it can be
  // re-embedded later.
  const chunks = chunkText(input.text);
  const insertChunk = db.prepare("INSERT INTO chunks (item_id, ord, content) VALUES (?, ?, ?)");
  const insertVec = db.prepare("INSERT INTO chunk_vectors (chunk_id, dim, vec) VALUES (?, ?, ?)");
  let embedded = 0;
  for (let i = 0; i < chunks.length; i++) {
    const chunkId = Number(insertChunk.run(itemId, i, chunks[i]).lastInsertRowid);
    try {
      const v = await embed(chunks[i]);
      insertVec.run(chunkId, v.length, vecToBlob(v));
      embedded++;
    } catch (err) {
      console.warn(`[ingest] embedding failed for chunk ${chunkId}:`, (err as Error).message);
    }
  }

  linkCollections(itemId, collections);

  const note = writeNote({
    slug: `${slugify(title)}-${itemId}`,
    title,
    frontmatter: {
      valet_id: itemId,
      type: input.type,
      source: input.source ?? "manual",
      url: input.url ?? "",
      collections,
      created: new Date().toISOString(),
    },
    body: summary + (input.url ? `\n\n[Source](${input.url})` : ""),
  });

  return {
    id: itemId,
    status: "created",
    title,
    collections,
    chunks: chunks.length,
    embedded: embedded === chunks.length && chunks.length > 0,
    note,
  };
}

function linkCollections(itemId: number, names: string[]): void {
  const db = getDb();
  const findCol = db.prepare("SELECT id FROM collections WHERE name = ?");
  const link = db.prepare(
    "INSERT OR IGNORE INTO item_collections (item_id, collection_id) VALUES (?, ?)",
  );
  for (const name of names) {
    const row = findCol.get(name) as { id: number } | undefined;
    if (row) link.run(itemId, row.id);
  }
}

function collectionsFor(itemId: number): string[] {
  const rows = getDb()
    .prepare(
      `SELECT c.name FROM collections c
         JOIN item_collections ic ON ic.collection_id = c.id
        WHERE ic.item_id = ?`,
    )
    .all(itemId) as { name: string }[];
  return rows.map((r) => r.name);
}
