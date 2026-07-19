import { readFileSync, existsSync, readdirSync } from "node:fs";
import path from "node:path";
import os from "node:os";

export interface Bookmark {
  title: string;
  url: string;
}

interface BmNode {
  type?: string;
  name?: string;
  url?: string;
  children?: BmNode[];
}

/** Locate Chrome's Bookmarks JSON files (all profiles), or a CHROME_BOOKMARKS override. */
function bookmarkFiles(): string[] {
  const override = process.env.CHROME_BOOKMARKS?.trim();
  if (override) return existsSync(override) ? [override] : [];

  const base = path.join(os.homedir(), "Library", "Application Support", "Google", "Chrome");
  if (!existsSync(base)) return [];

  const files: string[] = [];
  try {
    for (const entry of readdirSync(base, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue; // Default, Profile 1, Profile 2, …
      const f = path.join(base, entry.name, "Bookmarks");
      if (existsSync(f)) files.push(f);
    }
  } catch {
    /* unreadable — return what we have */
  }
  return files;
}

function collectUrls(node: BmNode, acc: Bookmark[]): void {
  if (node.type === "url" && node.url) acc.push({ title: node.name || node.url, url: node.url });
  for (const child of node.children ?? []) collectUrls(child, acc);
}

function findFolder(node: BmNode, folderName: string, acc: Bookmark[]): void {
  if (node.type === "folder" && node.name?.toLowerCase() === folderName.toLowerCase()) {
    collectUrls(node, acc);
  }
  for (const child of node.children ?? []) findFolder(child, folderName, acc);
}

/**
 * All bookmarks inside a Chrome folder named `folderName` (default "Briefing"),
 * searched recursively across every profile. De-duplicated by URL. Returns []
 * if Chrome/the folder isn't found — never throws.
 */
export function getBriefingBookmarks(
  folderName = process.env.BRIEFING_FOLDER || "Briefing",
): Bookmark[] {
  const seen = new Set<string>();
  const out: Bookmark[] = [];
  for (const file of bookmarkFiles()) {
    try {
      const data = JSON.parse(readFileSync(file, "utf8")) as { roots?: Record<string, BmNode> };
      for (const root of Object.values(data.roots ?? {})) {
        const acc: Bookmark[] = [];
        findFolder(root, folderName, acc);
        for (const b of acc) {
          if (!seen.has(b.url)) {
            seen.add(b.url);
            out.push(b);
          }
        }
      }
    } catch {
      /* skip locked/unreadable file */
    }
  }
  return out;
}
