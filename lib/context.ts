import { getDb } from "@/lib/db";
import { listProjects } from "@/lib/projects";
import { listNotifications } from "@/lib/notifications";
import { upcomingEvents } from "@/lib/calendar";

// Ignore Obsidian template/stub artifacts when listing recent captures.
const isJunkTitle = (t: string) => !t || t.includes("{{") || t.length < 3;

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

  const cleanRecent = recent.map((r) => r.title).filter((t) => !isJunkTitle(t));

  const lines: string[] = ["Current state of Josh's world (context; use when relevant):"];
  if (active.length)
    lines.push(
      "Active projects: " +
        active.map((p) => p.name + (p.next_action ? ` (next: ${p.next_action})` : "")).join("; "),
    );
  if (stalled.length) lines.push("Stalled projects: " + stalled.map((p) => p.name).join("; "));
  if (events.length) lines.push("Upcoming events: " + events.join("; "));
  if (cleanRecent.length) lines.push("Recently captured: " + cleanRecent.join("; "));
  if (notifs.length) lines.push("Open notifications: " + notifs.map((n) => n.title).join("; "));

  return lines.length > 1 ? lines.join("\n") : "";
}

/**
 * A deterministic, human-readable briefing digest (Markdown) — needs no AI, so
 * "Brief me" always shows something useful immediately, even while the local
 * model downloads or if no backend is available. The AI adds its take after.
 */
export async function buildDigest(): Promise<string> {
  const projects = listProjects();
  const active = projects.filter((p) => p.status === "active");
  const stalled = projects.filter((p) => p.status === "stalled");
  const notifs = listNotifications(false).slice(0, 6);
  let events: { start: Date; summary: string }[] = [];
  try {
    events = await upcomingEvents(3);
  } catch {
    /* calendar optional */
  }

  const now = new Date();
  const part = now.getHours() < 12 ? "morning" : now.getHours() < 18 ? "afternoon" : "evening";
  const when = now.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });

  const L: string[] = [`Good ${part}, Josh — ${when}.`, ""];
  if (active.length) {
    L.push("## Active projects");
    for (const p of active) L.push(`- **${p.name}**${p.next_action ? ` — next: ${p.next_action}` : ""}`);
    L.push("");
  }
  if (stalled.length) {
    L.push("## Stalled");
    for (const p of stalled) L.push(`- ${p.name}`);
    L.push("");
  }
  if (events.length) {
    L.push("## Upcoming");
    for (const e of events.slice(0, 6)) L.push(`- ${e.start.toLocaleString()} — ${e.summary}`);
    L.push("");
  }
  if (notifs.length) {
    L.push("## Worth your attention");
    for (const n of notifs) L.push(`- ${n.title}`);
    L.push("");
  }
  return L.join("\n");
}
