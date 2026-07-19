import { getBriefingBookmarks } from "@/lib/bookmarks";
import { extractUrl } from "@/lib/extract";

// Reads the sources in your Chrome "Briefing" folder and turns them into a
// synthesized brief. This is the engine behind **The Paper Filter** — a quick,
// relatively unbiased news brief across multiple sources.

export interface BriefingItem {
  title: string;
  url: string;
  summary: string;
  /** Longer extracted text, for AI synthesis (not shown directly). */
  body: string;
}

// In-memory cache so repeat briefs are fast (sources refetched hourly).
const cache = new Map<string, { item: BriefingItem; ts: number }>();
const TTL_MS = 60 * 60 * 1000;

function preview(ex: { title: string; text: string; excerpt?: string }): string {
  const raw = ex.excerpt && ex.excerpt.length > 40 ? ex.excerpt : ex.text;
  return raw.replace(/\s+/g, " ").trim().slice(0, 280);
}

/** Fetch + extract each Briefing source in parallel (bounded, cached, resilient). */
export async function enrichBriefingBookmarks(limit = 12): Promise<BriefingItem[]> {
  const marks = getBriefingBookmarks().slice(0, limit);
  const now = Date.now();

  return Promise.all(
    marks.map(async (m): Promise<BriefingItem> => {
      const cached = cache.get(m.url);
      if (cached && now - cached.ts < TTL_MS) {
        return { ...cached.item, title: m.title || cached.item.title };
      }
      try {
        const ex = await extractUrl(m.url, 8000);
        const item: BriefingItem = {
          title: m.title || ex.title,
          url: m.url,
          summary: preview(ex) || "(no preview available)",
          body: ex.text.replace(/\s+/g, " ").trim().slice(0, 900),
        };
        cache.set(m.url, { item, ts: now });
        return item;
      } catch {
        return { title: m.title, url: m.url, summary: "(couldn't load — click to read)", body: "" };
      }
    }),
  );
}

/** Render the sources as a click-through "What to read" section (Markdown). */
export function readingSection(items: BriefingItem[]): string {
  if (!items.length) return "";
  const lines = items.map((i) => `- **[${i.title}](${i.url})** — ${i.summary}`);
  return `## What to read — from your “Briefing” folder\n${lines.join("\n")}\n\n`;
}

/** Compact source digest fed to the model for synthesis (bounded for small models). */
export function readingForAI(items: BriefingItem[], maxSources = 8): string {
  return items
    .filter((i) => i.body)
    .slice(0, maxSources)
    .map((i) => `SOURCE: ${i.title} (${i.url})\n${i.body}`)
    .join("\n\n---\n\n");
}
