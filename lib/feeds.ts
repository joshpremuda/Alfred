import { JSDOM } from "jsdom";

// RSS/Atom reading for The Paper Filter: turn a news-site URL into its current
// headlines. Uses jsdom's DOMParser (no new dependency) and auto-discovers each
// site's feed from its homepage, with common-path and known fallbacks.

export interface FeedItem {
  title: string;
  link: string;
  date: Date | null;
  summary: string;
}

// A few known feeds for sites that don't reliably advertise one in <head>.
const KNOWN_FEEDS: Record<string, string> = {
  "nytimes.com": "https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml",
  "bbc.com": "https://feeds.bbci.co.uk/news/rss.xml",
  "bbc.co.uk": "https://feeds.bbci.co.uk/news/rss.xml",
  "economist.com": "https://www.economist.com/latest/rss.xml",
  "ft.com": "https://www.ft.com/rss/home",
  "thefp.com": "https://www.thefp.com/feed",
  "theweek.com": "https://theweek.com/feeds/all.rss.xml",
};

const feedUrlCache = new Map<string, string | null>();

function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 220);
}
function parseDate(s: string): Date | null {
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Parse an RSS 2.0 or Atom feed into items (title, link, date, summary). */
export function parseFeed(xml: string): FeedItem[] {
  let doc: Document;
  try {
    const { window } = new JSDOM("");
    doc = new window.DOMParser().parseFromString(xml, "text/xml");
  } catch {
    return [];
  }
  if (doc.getElementsByTagName("parsererror").length) return [];

  const text = (el: Element, tag: string) =>
    (el.getElementsByTagName(tag)[0]?.textContent || "").trim();

  const items: FeedItem[] = [];
  for (const it of Array.from(doc.getElementsByTagName("item"))) {
    items.push({
      title: text(it, "title"),
      link: text(it, "link"),
      date: parseDate(text(it, "pubDate") || text(it, "date")),
      summary: stripHtml(text(it, "description")),
    });
  }
  if (!items.length) {
    for (const en of Array.from(doc.getElementsByTagName("entry"))) {
      const linkEl = en.getElementsByTagName("link")[0];
      items.push({
        title: text(en, "title"),
        link: linkEl?.getAttribute("href") || text(en, "link"),
        date: parseDate(text(en, "updated") || text(en, "published")),
        summary: stripHtml(text(en, "summary") || text(en, "content")),
      });
    }
  }
  return items.filter((i) => i.title && i.link);
}

async function fetchText(url: string, ms = 8000): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; ValetBot/1.0)" },
      redirect: "follow",
      signal: AbortSignal.timeout(ms),
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

async function discoverFeed(pageUrl: string): Promise<string | null> {
  const origin = new URL(pageUrl).origin;
  const host = new URL(pageUrl).hostname.replace(/^www\./, "");
  if (feedUrlCache.has(origin)) return feedUrlCache.get(origin)!;

  let feed: string | null = KNOWN_FEEDS[host] ?? null;

  if (!feed) {
    const html = await fetchText(pageUrl);
    if (html) {
      const tag = html.match(/<link[^>]+type=["']application\/(?:rss|atom)\+xml["'][^>]*>/i)?.[0];
      const href = tag?.match(/href=["']([^"']+)["']/i)?.[1];
      if (href) feed = new URL(href, pageUrl).toString();
    }
  }
  if (!feed) {
    for (const p of ["/feed", "/rss", "/rss.xml", "/feed.xml", "/index.xml", "/feed.rss", "/atom.xml"]) {
      const xml = await fetchText(origin + p, 6000);
      if (xml && parseFeed(xml).length) {
        feed = origin + p;
        break;
      }
    }
  }
  feedUrlCache.set(origin, feed);
  return feed;
}

/** Current headlines for a news-site URL (most recent first). [] if no feed. */
export async function fetchHeadlines(pageUrl: string, n = 3): Promise<FeedItem[]> {
  const feed = await discoverFeed(pageUrl);
  if (!feed) return [];
  const xml = await fetchText(feed);
  if (!xml) return [];
  return parseFeed(xml)
    .sort((a, b) => (b.date?.getTime() ?? 0) - (a.date?.getTime() ?? 0))
    .slice(0, n);
}

export function relativeTime(d: Date | null): string {
  if (!d) return "";
  const mins = Math.round((Date.now() - d.getTime()) / 60000);
  if (mins < 60) return `${Math.max(1, mins)}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  return days === 1 ? "yesterday" : `${days}d ago`;
}
