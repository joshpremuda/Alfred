import { getDb } from "@/lib/db";
import { createNotification } from "@/lib/notifications";

export interface Project {
  id: number;
  name: string;
  status: "active" | "stalled" | "done" | "someday";
  notes: string | null;
  next_action: string | null;
  last_activity_at: string;
  created_at: string;
}

const STALL_DAYS = 14;

export function getProject(id: number): Project | undefined {
  return getDb().prepare("SELECT * FROM projects WHERE id = ?").get(id) as Project | undefined;
}

export function listProjects(): Project[] {
  return getDb()
    .prepare(
      `SELECT * FROM projects
        ORDER BY CASE status
          WHEN 'active' THEN 0 WHEN 'stalled' THEN 1 WHEN 'someday' THEN 2 ELSE 3 END,
          last_activity_at DESC`,
    )
    .all() as Project[];
}

export function upsertProject(p: {
  name: string;
  status?: Project["status"];
  notes?: string;
  next_action?: string;
}): Project {
  const db = getDb();
  const existing = db.prepare("SELECT id FROM projects WHERE name = ?").get(p.name) as
    | { id: number }
    | undefined;
  if (existing) {
    db.prepare(
      `UPDATE projects
          SET status = COALESCE(?, status),
              notes = COALESCE(?, notes),
              next_action = COALESCE(?, next_action),
              last_activity_at = datetime('now')
        WHERE id = ?`,
    ).run(p.status ?? null, p.notes ?? null, p.next_action ?? null, existing.id);
    return getProject(existing.id)!;
  }
  const id = Number(
    db
      .prepare("INSERT INTO projects (name, status, notes, next_action) VALUES (?, ?, ?, ?)")
      .run(p.name, p.status ?? "active", p.notes ?? null, p.next_action ?? null).lastInsertRowid,
  );
  return getProject(id)!;
}

/** Flag active projects with no activity in STALL_DAYS as stalled + notify. */
export function detectStalled(): number {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT id, name FROM projects
        WHERE status = 'active' AND last_activity_at < datetime('now', ?)`,
    )
    .all(`-${STALL_DAYS} days`) as { id: number; name: string }[];
  for (const r of rows) {
    db.prepare("UPDATE projects SET status = 'stalled' WHERE id = ?").run(r.id);
    createNotification("stalled", `Project stalled: ${r.name}`, `No activity in ${STALL_DAYS}+ days.`, 2);
  }
  return rows.length;
}
