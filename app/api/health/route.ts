import { getDb } from "@/lib/db";
import { hasApiKey } from "@/lib/claude";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const db = getDb();
  const count = (q: string) => (db.prepare(q).get() as { c: number }).c;

  return Response.json({
    ok: true,
    backend: hasApiKey() ? "claude" : "local",
    hasKey: hasApiKey(),
    vault: process.env.BRAIN_VAULT || "(default: data/vault)",
    models: {
      anthropic: process.env.ANTHROPIC_MODEL || "claude-sonnet-5",
      local: process.env.LOCAL_MODEL || "onnx-community/Qwen2.5-0.5B-Instruct",
      embed: process.env.EMBED_MODEL || "Xenova/all-MiniLM-L6-v2",
    },
    counts: {
      items: count("SELECT COUNT(*) AS c FROM items"),
      chunks: count("SELECT COUNT(*) AS c FROM chunks"),
      embedded: count("SELECT COUNT(*) AS c FROM chunk_vectors"),
      projects: count("SELECT COUNT(*) AS c FROM projects"),
      ideas: count("SELECT COUNT(*) AS c FROM ideas"),
      unreadNotifications: count("SELECT COUNT(*) AS c FROM notifications WHERE read_at IS NULL"),
    },
  });
}
