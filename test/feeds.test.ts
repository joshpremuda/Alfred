import { describe, it, expect } from "vitest";
import { parseFeed, relativeTime } from "@/lib/feeds";

const RSS = `<?xml version="1.0"?>
<rss version="2.0"><channel>
  <title>Example News</title>
  <item>
    <title>Markets rally on rate news</title>
    <link>https://example.com/a</link>
    <pubDate>Wed, 15 Jul 2026 09:00:00 GMT</pubDate>
    <description>&lt;p&gt;Stocks climbed as...&lt;/p&gt;</description>
  </item>
  <item>
    <title>Coffee prices hit record</title>
    <link>https://example.com/b</link>
    <pubDate>Wed, 15 Jul 2026 08:00:00 GMT</pubDate>
    <description>Arabica futures...</description>
  </item>
</channel></rss>`;

const ATOM = `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>Atom Example</title>
  <entry>
    <title>Design trends 2026</title>
    <link href="https://example.com/atom1"/>
    <updated>2026-07-15T10:00:00Z</updated>
    <summary>Editorial minimalism...</summary>
  </entry>
</feed>`;

describe("parseFeed", () => {
  it("parses RSS items (title, link, date, cleaned summary)", () => {
    const items = parseFeed(RSS);
    expect(items).toHaveLength(2);
    expect(items[0].title).toBe("Markets rally on rate news");
    expect(items[0].link).toBe("https://example.com/a");
    expect(items[0].summary).not.toMatch(/</); // HTML stripped
    expect(items[0].date?.getUTCFullYear()).toBe(2026);
  });

  it("parses Atom entries with link href", () => {
    const items = parseFeed(ATOM);
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe("Design trends 2026");
    expect(items[0].link).toBe("https://example.com/atom1");
  });

  it("returns [] for non-feed input", () => {
    expect(parseFeed("<html><body>not a feed</body></html>")).toEqual([]);
  });
});

describe("relativeTime", () => {
  it("formats recent times", () => {
    expect(relativeTime(new Date(Date.now() - 30 * 60000))).toMatch(/m ago/);
    expect(relativeTime(new Date(Date.now() - 3 * 3600000))).toBe("3h ago");
    expect(relativeTime(new Date(Date.now() - 24 * 3600000))).toBe("yesterday");
    expect(relativeTime(null)).toBe("");
  });
});
