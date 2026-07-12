import Database from "better-sqlite3";
import { readFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";

export type ChatRole = "user" | "assistant";
export interface ChatMessage {
  role: ChatRole;
  content: string;
}

const CONVERSATION = "main";

// Reuse the connection across hot reloads in dev.
const globalForDb = globalThis as unknown as { __valetDb?: Database.Database };

export function getDb(): Database.Database {
  if (globalForDb.__valetDb) return globalForDb.__valetDb;

  const dataDir = path.join(process.cwd(), "data");
  if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });

  const db = new Database(path.join(dataDir, "valet.db"));
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  const schema = readFileSync(path.join(process.cwd(), "db", "schema.sql"), "utf8");
  db.exec(schema);

  globalForDb.__valetDb = db;
  return db;
}

export function addMessage(role: ChatRole, content: string): void {
  getDb()
    .prepare("INSERT INTO messages (conversation_id, role, content) VALUES (?, ?, ?)")
    .run(CONVERSATION, role, content);
}

export function getHistory(limit = 40): ChatMessage[] {
  const rows = getDb()
    .prepare(
      "SELECT role, content FROM messages WHERE conversation_id = ? ORDER BY id DESC LIMIT ?",
    )
    .all(CONVERSATION, limit) as ChatMessage[];
  return rows.reverse();
}
