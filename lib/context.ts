import { getDb } from "@/lib/db";
import { listProjects } from "@/lib/projects";
import { listNotifications } from "@/lib/notifications";
import { upcomingEvents } from "@/lib/calendar";

/**
 * A compact snapshot of Josh's world, injected into chat + briefings so Alfred
 * can answer "what should I work on?", "what's stalled?", etc. Kept short to
 * stay token-cheap.
 */
export async function buildStateContext(): Promise<string> {
  const projects = listProjects();
  const active = projects.filter((p) => p.status === "active");
  const stalled = projects.filter((p) => p.status === "stalled");
  const notifs = listNotifications(false).slice(0, 6);
  const recent = getDb().prepare("SELECT title FROM items ORDER BY id DESC LIMIT 6").all() as {
    title: string;
  }[];

  let events: string[] = [];
  try {
    events = (await upcomingEvents(4)).slice(0, 6).map((e) => `${e.start.toLocaleString()} — ${e.summary}`);
  } catch {
    /* calendar optional */
  }

  const lines: string[] = ["Current state of Josh's world (context; use when relevant):"];
  if (active.length)
    lines.push(
      "Active projects: " +
        active.map((p) => p.name + (p.next_action ? ` (next: ${p.next_action})` : "")).join("; "),
    );
  if (stalled.length) lines.push("Stalled projects: " + stalled.map((p) => p.name).join("; "));
  if (events.length) lines.push("Upcoming events: " + events.join("; "));
  if (recent.length) lines.push("Recently captured: " + recent.map((r) => r.title).join("; "));
  if (notifs.length) lines.push("Open notifications: " + notifs.map((n) => n.title).join("; "));

  return lines.length > 1 ? lines.join("\n") : "";
}
