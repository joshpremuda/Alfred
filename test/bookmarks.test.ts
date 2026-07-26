import { describe, it, expect, afterEach } from "vitest";
import { writeFileSync, mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { getBriefingBookmarks } from "@/lib/bookmarks";

const SAMPLE = {
  roots: {
    bookmark_bar: {
      type: "folder",
      name: "Bookmarks bar",
      children: [
        {
          type: "folder",
          name: "Briefing",
          children: [
            { type: "url", name: "Monocle", url: "https://monocle.com" },
            {
              type: "folder",
              name: "Deep",
              children: [{ type: "url", name: "Nested", url: "https://nested.example" }],
            },
          ],
        },
        { type: "url", name: "Not in briefing", url: "https://x.example" },
      ],
    },
    other: { type: "folder", name: "Other", children: [] },
  },
};

afterEach(() => {
  delete process.env.CHROME_BOOKMARKS;
});

describe("getBriefingBookmarks", () => {
  it("collects urls under the Briefing folder (recursively) and excludes others", () => {
    const f = path.join(mkdtempSync(path.join(os.tmpdir(), "bm-")), "Bookmarks");
    writeFileSync(f, JSON.stringify(SAMPLE));
    process.env.CHROME_BOOKMARKS = f;

    const urls = getBriefingBookmarks().map((b) => b.url);
    expect(urls).toContain("https://monocle.com");
    expect(urls).toContain("https://nested.example");
    expect(urls).not.toContain("https://x.example");
  });

  it("returns [] when the file doesn't exist", () => {
    process.env.CHROME_BOOKMARKS = "/no/such/Bookmarks";
    expect(getBriefingBookmarks()).toEqual([]);
  });
});
