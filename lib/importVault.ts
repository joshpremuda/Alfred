import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { vaultRoot } from "@/lib/vault";
import { ingestItem } from "@/lib/ingest";

function walk(dir: string, acc: string[], depth = 0): string[] {
  if (depth > 6) return acc;
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return acc;
  }
  for (const e of entries) {
    if (e.name.startsWith(".")) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, acc, depth + 1);
    else if (e.name.toLowerCase().endsWith(".md")) acc.push(full);
  }
  return acc;
}

/**
 * Ingest Josh's existing Obsidian notes so the vault is useful on day one.
 * Skips notes Valet itself wrote (Valet/Inbox) and dedupes by content hash.
 * Does not re-write imported notes back into the vault.
 */
export async function importVault(limit = 500): Promise<{
  scanned: number;
  imported: number;
  duplicates: number;
}> {
  const root = vaultRoot();
  const inbox = path.join(root, "Valet", "Inbox");
  const files = walk(root, []).filter((f) => !f.startsWith(inbox)).slice(0, limit);

  let imported = 0;
  let duplicates = 0;
  for (const f of files) {
    let raw: string;
    try {
      raw = readFileSync(f, "utf8");
    } catch {
      continue;
    }
    // Skip Obsidian templates and trivially-short stubs.
    if (/\/(templates|\.trash)\//i.test(f) || f.includes("{{")) continue;
    // Strip YAML frontmatter.
    const body = raw.replace(/^---\n[\s\S]*?\n---\n/, "").trim();
    if (body.length < 40 || body.includes("{{")) continue; // template/placeholder or empty
    const title = body.match(/^#\s+(.+)$/m)?.[1]?.trim() || path.basename(f, ".md");

    const res = await ingestItem({
      type: "note",
      text: body,
      title,
      source: "obsidian",
      writeVaultNote: false,
    });
    if (res.status === "created") imported++;
    else duplicates++;
  }
  return { scanned: files.length, imported, duplicates };
}
