#!/usr/bin/env node
// gather.mjs — pull today's headlines from each source's RSS/Atom feed.
// Standalone (only needs `jsdom`, already installed at the repo root). Writes
// issue-data.json, which the agent turns into a conversational issue.
//
//   node paper-filter/gather.mjs
//
// Feeds are auto-discovered from each site (known feeds + <link rel=alternate>
// + common paths). Paywalled sites without an open feed are skipped gracefully.

import { JSDOM } from "jsdom";
import { readFileSync, writeFileSync } from "node:fs";

const KNOWN_FEEDS = {
  "nytimes.com": "https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml",
  "bbc.com": "https://feeds.bbci.co.uk/news/rss.xml",
  "reuters.com": "https://www.reutersagency.com/feed/",
  "economist.com": "https://www.economist.com/latest/rss.xml",
  "ft.com": "https://www.ft.com/rss/home",
  "thefp.com": "https://www.thefp.com/feed",
  "theweek.com": "https://theweek.com/feeds/all.rss.xml",
  "apnews.com": "https://apnews.com/index.rss",
};

const strip = (s) => s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 240);
const toDate = (s) => {
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
};

function parseFeed(xml) {
  let doc;
  try {
    const { window } = new JSDOM("");
    doc = new window.DOMParser().parseFromString(xml, "text/xml");
  } catch {
    return [];
  }
  if (doc.getElementsByTagName("parsererror").length) return [];
  const text = (el, tag) => (el.getElementsByTagName(tag)[0]?.textContent || "").trim();
  const items = [];
  for (const it of [...doc.getElementsByTagName("item")]) {
    items.push({ title: text(it, "title"), link: text(it, "link"), date: toDate(text(it, "pubDate") || text(it, "date")), summary: strip(text(it, "description")) });
  }
  if (!items.length) {
    for (const en of [...doc.getElementsByTagName("entry")]) {
      const l = en.getElementsByTagName("link")[0];
      items.push({ title: text(en, "title"), link: l?.getAttribute("href") || text(en, "link"), date: toDate(text(en, "updated") || text(en, "published")), summary: strip(text(en, "summary") || text(en, "content")) });
    }
  }
  return items.filter((i) => i.title && i.link);
}

async function fetchText(url, ms = 9000) {
  try {
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (compatible; PaperFilter/1.0)" }, redirect: "follow", signal: AbortSignal.timeout(ms) });
    return res.ok ? await res.text() : null;
  } catch {
    return null;
  }
}

async function discoverFeed(pageUrl) {
  const { origin, hostname } = new URL(pageUrl);
  const host = hostname.replace(/^www\./, "");
  if (KNOWN_FEEDS[host]) return KNOWN_FEEDS[host];
  const html = await fetchText(pageUrl);
  if (html) {
    const tag = html.match(/<link[^>]+type=["']application\/(?:rss|atom)\+xml["'][^>]*>/i)?.[0];
    const href = tag?.match(/href=["']([^"']+)["']/i)?.[1];
    if (href) return new URL(href, pageUrl).toString();
  }
  for (const p of ["/feed", "/rss", "/rss.xml", "/feed.xml", "/index.xml", "/feed.rss", "/atom.xml"]) {
    const xml = await fetchText(origin + p, 7000);
    if (xml && parseFeed(xml).length) return origin + p;
  }
  return null;
}

// Google News titles come as "Headline - Publisher" — drop the trailing source.
const cleanTitle = (t, isGoogle) => (isGoogle ? t.replace(/\s+-\s+[^-]+$/, "").trim() : t);

async function headlines(source, n = 3) {
  // An explicit `feed` (e.g. a Google News RSS search) wins over auto-discovery.
  const feed = source.feed || (await discoverFeed(source.url));
  if (!feed) return [];
  const xml = await fetchText(feed);
  if (!xml) return [];
  const isGoogle = /news\.google\.com/.test(feed);
  return parseFeed(xml)
    .sort((a, b) => (b.date ? +b.date : 0) - (a.date ? +a.date : 0))
    .slice(0, n)
    .map((i) => ({ title: cleanTitle(i.title, isGoogle), link: i.link, summary: i.summary }));
}

const sources = JSON.parse(readFileSync(new URL("./sources.json", import.meta.url)));
const result = await Promise.all(
  sources.map(async (s) => ({ name: s.name, url: s.url, headlines: await headlines(s, 3) })),
);

const outPath = new URL("./issue-data.json", import.meta.url);
writeFileSync(outPath, JSON.stringify({ generatedAt: new Date().toISOString(), sources: result }, null, 2));
const live = result.filter((s) => s.headlines.length).length;
const total = result.reduce((n, s) => n + s.headlines.length, 0);
console.log(`Gathered ${total} headlines from ${live}/${result.length} sources → paper-filter/issue-data.json`);
for (const s of result) console.log(`  ${s.headlines.length ? "✓" : "·"} ${s.name}${s.headlines.length ? "" : "  (no open feed)"}`);
