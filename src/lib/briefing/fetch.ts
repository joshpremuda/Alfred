import * as cheerio from 'cheerio';
import { BRIEFING_FEEDS, type FeedSource } from './feeds';

export interface FeedItem {
  title: string;
  link?: string;
  description?: string;
}

export interface FeedResult {
  source: string;
  items: FeedItem[];
  error?: string;
  method: 'rss' | 'scrape' | 'failed';
}

const FETCH_TIMEOUT = 8000;

async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Alfred/1.0; +https://github.com/joshpremuda/alfred)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });
  } finally {
    clearTimeout(timer);
  }
}

async function parseRss(xml: string): Promise<FeedItem[]> {
  const $ = cheerio.load(xml, { xmlMode: true });
  const items: FeedItem[] = [];

  $('item, entry').each((_, el) => {
    const $el = $(el);
    const title = $el.find('title').first().text().trim();
    const link = $el.find('link').first().text().trim() ||
                 $el.find('link').first().attr('href') || '';
    const description = $el.find('description, summary, content').first().text()
      .replace(/<[^>]+>/g, '')
      .trim()
      .slice(0, 300);

    if (title) items.push({ title, link, description });
  });

  return items.slice(0, 8);
}

async function fetchRss(source: FeedSource): Promise<FeedResult> {
  if (!source.rss) throw new Error('No RSS URL');
  const res = await fetchWithTimeout(source.rss);
  if (!res.ok) throw new Error(`RSS returned ${res.status}`);
  const xml = await res.text();
  const items = await parseRss(xml);
  if (items.length === 0) throw new Error('No items in feed');
  return { source: source.name, items, method: 'rss' };
}

async function scrapeHeadlines(source: FeedSource): Promise<FeedResult> {
  const res = await fetchWithTimeout(source.homepage);
  if (!res.ok) throw new Error(`Homepage returned ${res.status}`);
  const html = await res.text();
  const $ = cheerio.load(html);

  const selectors = source.selectors || ['h1', 'h2', 'h3'];
  const seen = new Set<string>();
  const items: FeedItem[] = [];

  for (const sel of selectors) {
    $(sel).each((_, el) => {
      const text = $(el).text().trim().replace(/\s+/g, ' ');
      if (text.length > 20 && text.length < 200 && !seen.has(text)) {
        seen.add(text);
        items.push({ title: text });
      }
    });
    if (items.length >= 8) break;
  }

  if (items.length === 0) throw new Error('No headlines found');
  return { source: source.name, items: items.slice(0, 8), method: 'scrape' };
}

export async function fetchAllFeeds(extra: FeedSource[] = []): Promise<FeedResult[]> {
  const allFeeds = [...BRIEFING_FEEDS, ...extra];
  const results = await Promise.allSettled(
    allFeeds.map(async (source): Promise<FeedResult> => {
      try {
        return await fetchRss(source);
      } catch {
        try {
          return await scrapeHeadlines(source);
        } catch (err2) {
          const msg = err2 instanceof Error ? err2.message : 'Failed';
          return { source: source.name, items: [], error: msg, method: 'failed' };
        }
      }
    })
  );

  return results.map((r, i) =>
    r.status === 'fulfilled'
      ? r.value
      : { source: allFeeds[i].name, items: [], error: String(r.reason), method: 'failed' as const }
  );
}

export function buildFeedContext(results: FeedResult[]): string {
  const successful = results.filter(r => r.items.length > 0);
  const failed = results.filter(r => r.items.length === 0);

  const lines: string[] = [];

  for (const feed of successful) {
    lines.push(`\n## ${feed.source}${feed.method === 'scrape' ? ' (scraped)' : ''}`);
    for (const item of feed.items) {
      lines.push(`- ${item.title}${item.description ? ` — ${item.description.slice(0, 150)}` : ''}`);
    }
  }

  if (failed.length > 0) {
    lines.push(`\n## Could not reach: ${failed.map(f => f.source).join(', ')}`);
  }

  return lines.join('\n');
}
