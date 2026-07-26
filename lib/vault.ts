import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

/** The Obsidian vault root (BRAIN_VAULT), or a local fallback for dev. */
export function vaultRoot(): string {
  const configured = process.env.BRAIN_VAULT?.trim();
  return configured || path.join(process.cwd(), "data", "vault");
}

export function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "note"
  );
}

export interface NoteInput {
  slug: string;
  title: string;
  frontmatter: Record<string, unknown>;
  body: string;
}

/** Write a Markdown note (YAML frontmatter) into <vault>/Valet/Inbox/. */
export function writeNote(n: NoteInput): string {
  const dir = path.join(vaultRoot(), "Valet", "Inbox");
  mkdirSync(dir, { recursive: true });

  const fm = Object.entries(n.frontmatter)
    .map(([k, v]) => `${k}: ${Array.isArray(v) ? JSON.stringify(v) : String(v)}`)
    .join("\n");
  const md = `---\n${fm}\n---\n\n# ${n.title}\n\n${n.body}\n`;

  const file = path.join(dir, `${n.slug}.md`);
  writeFileSync(file, md, "utf8");
  return file;
}
