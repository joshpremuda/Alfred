export interface CalEvent {
  summary: string;
  start: Date;
  end: Date | null;
}

/** Minimal ICS parser: pulls SUMMARY / DTSTART / DTEND from each VEVENT. */
export function parseIcs(ics: string): CalEvent[] {
  // Normalize CRLF and unfold continuation lines (RFC 5545: lines starting with space/tab).
  const text = ics.replace(/\r\n/g, "\n").replace(/\n[ \t]/g, "");
  const events: CalEvent[] = [];
  const blocks = text.split("BEGIN:VEVENT").slice(1);
  for (const b of blocks) {
    const body = "\n" + b.split("END:VEVENT")[0];
    const summary = matchLine(body, "SUMMARY") ?? "(untitled)";
    const dtstart = matchLine(body, "DTSTART");
    if (!dtstart) continue;
    const start = parseIcsDate(dtstart);
    if (!start) continue;
    const dtend = matchLine(body, "DTEND");
    events.push({ summary, start, end: dtend ? parseIcsDate(dtend) : null });
  }
  return events;
}

function matchLine(body: string, key: string): string | null {
  const m = body.match(new RegExp(`\\n${key}[^:\\n]*:(.*)`));
  return m ? m[1].trim().replace(/\\,/g, ",").replace(/\\n/gi, " ") : null;
}

function parseIcsDate(v: string): Date | null {
  const m = v.match(/(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?/);
  if (!m) return null;
  const y = +m[1];
  const mo = +m[2] - 1;
  const d = +m[3];
  if (m[4] === undefined) return new Date(y, mo, d);
  const h = +m[4];
  const mi = +m[5];
  const s = +m[6];
  return m[7] ? new Date(Date.UTC(y, mo, d, h, mi, s)) : new Date(y, mo, d, h, mi, s);
}

/**
 * Upcoming events from a published ICS calendar. Configure one of:
 *   CALENDAR_ICS_URL  — an iCloud/Google published .ics URL (recommended)
 *   CALENDAR_ICS_FILE — a local exported .ics path
 * Returns [] gracefully when neither is set or fetch fails.
 */
export async function upcomingEvents(days = 7): Promise<CalEvent[]> {
  const url = process.env.CALENDAR_ICS_URL?.trim();
  const file = process.env.CALENDAR_ICS_FILE?.trim();
  let ics = "";
  try {
    if (url) {
      const r = await fetch(url);
      if (r.ok) ics = await r.text();
    } else if (file) {
      const { readFileSync } = await import("node:fs");
      ics = readFileSync(file, "utf8");
    }
  } catch {
    return [];
  }
  if (!ics) return [];

  const now = new Date();
  const horizon = new Date(now.getTime() + days * 86_400_000);
  return parseIcs(ics)
    .filter((e) => (e.end ? e.end >= now : e.start >= now) && e.start <= horizon)
    .sort((a, b) => a.start.getTime() - b.start.getTime())
    .slice(0, 20);
}
