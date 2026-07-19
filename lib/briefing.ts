import { getBriefingBookmarks } from "@/lib/bookmarks";
import { fetchHeadlines, relativeTime } from "@/lib/feeds";
import { extractUrl } from "@/lib/extract";

// The Paper Filter: read the news sources in the configured Chrome folder and
// turn them into today's headlines + a synthesized, relatively-unbiased brief.

export interface Source {
  title: string;
  url: string;
  headlines: { title: string; link: string; when: string }[];
  note?: string; // preview or reason there are no headlines
}

const cache = new Map<string, { source: Source; ts: number }>();
const TTL_MS = 30 * 60 * 1000; // headlines refresh every 30 min

/** Fetch current headlines for each source (RSS first, preview fallback). */
export async function gatherSources(limit = 16): Promise<Source[]> {
  const marks = getBriefingBookmarks().slice(0, limit);
  const now = Date.now();
  return Promise.all(
    marks.map(async (m): Promise<Source> => {
      const cached = cache.get(m.url);
      if (cached && now - cached.ts < TTL_MS) return cached.source;

      let source: Source;
      try {
        const items = await fetchHeadlines(m.url, 3);
        if (items.length) {
          source = {
            title: m.title,
            url: m.url,
            headlines: items.map((i) => ({ title: i.title, link: i.link, when: relativeTime(i.date) })),
          };
        } else {
          const ex = await extractUrl(m.url, 8000);
          const note = (ex.excerpt || ex.text).replace(/\s+/g, " ").trim().slice(0, 160);
          source = { title: m.title || ex.title, url: m.url, headlines: [], note: note || "no feed found" };
        }
      } catch {
        source = { title: m.title, url: m.url, headlines: [], note: "couldn't load — click to read" };
      }
      cache.set(m.url, { source, ts: now });
      return source;
    }),
  );
}

/** Headlines grouped by source (Markdown, with click-through links). */
export function headlinesMarkdown(sources: Source[]): string {
  const out: string[] = [];
  for (const s of sources) {
    if (s.headlines.length) {
      out.push(`### [${s.title}](${s.url})`);
      for (const h of s.headlines) out.push(`- [${h.title}](${h.link})${h.when ? ` · ${h.when}` : ""}`);
    } else {
      out.push(`### [${s.title}](${s.url}) — _${s.note ?? "open ↗"}_`);
    }
    out.push("");
  }
  return out.join("\n");
}

/** Plain headline list fed to Claude for synthesis (facts only). */
export function sourcesForAI(sources: Source[], maxHeadlines = 45): string {
  const lines: string[] = [];
  let count = 0;
  for (const s of sources) {
    if (!s.headlines.length || count >= maxHeadlines) continue;
    lines.push(`SOURCE — ${s.title}:`);
    for (const h of s.headlines) {
      if (count++ >= maxHeadlines) break;
      lines.push(`- ${h.title}`);
    }
    lines.push("");
  }
  return lines.join("\n").trim();
}
