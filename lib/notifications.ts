import { getDb } from "@/lib/db";

export interface Notification {
  id: number;
  kind: string;
  title: string;
  body: string | null;
  importance: number;
  created_at: string;
  read_at: string | null;
}

/** Create a notification, de-duplicating against an existing unread one. */
export function createNotification(
  kind: string,
  title: string,
  body = "",
  importance = 1,
): number {
  const db = getDb();
  const existing = db
    .prepare("SELECT id FROM notifications WHERE kind = ? AND title = ? AND read_at IS NULL")
    .get(kind, title) as { id: number } | undefined;
  if (existing) return existing.id;
  return Number(
    db
      .prepare("INSERT INTO notifications (kind, title, body, importance) VALUES (?, ?, ?, ?)")
      .run(kind, title, body, importance).lastInsertRowid,
  );
}

export function listNotifications(includeRead = false): Notification[] {
  const db = getDb();
  const q = includeRead
    ? "SELECT * FROM notifications ORDER BY (read_at IS NULL) DESC, importance DESC, id DESC LIMIT 100"
    : "SELECT * FROM notifications WHERE read_at IS NULL ORDER BY importance DESC, id DESC LIMIT 100";
  return db.prepare(q).all() as Notification[];
}

export function unreadCount(): number {
  return (
    getDb().prepare("SELECT COUNT(*) AS c FROM notifications WHERE read_at IS NULL").get() as {
      c: number;
    }
  ).c;
}

export function markRead(id: number): void {
  getDb().prepare("UPDATE notifications SET read_at = datetime('now') WHERE id = ?").run(id);
}

export function markAllRead(): void {
  getDb().prepare("UPDATE notifications SET read_at = datetime('now') WHERE read_at IS NULL").run();
}
