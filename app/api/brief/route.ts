import { streamAssistant, briefPrompt } from "@/lib/claude";
import { buildStateContext, buildDigest } from "@/lib/context";
import { detectStalled } from "@/lib/projects";
import { connectRecentItems } from "@/lib/ideas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  // Refresh derived signals before briefing (both are non-fatal).
  try {
    detectStalled();
  } catch (err) {
    console.warn("[brief] stalled detection skipped:", (err as Error).message);
  }
  try {
    await connectRecentItems();
  } catch (err) {
    console.warn("[brief] idea connections skipped:", (err as Error).message);
  }

  const state = await buildStateContext();
  const digest = await buildDigest();
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (s: string) => controller.enqueue(encoder.encode(s));
      try {
        // Deterministic personal digest — always accurate, shows instantly.
        send(digest + "\n\n---\n\n### Alfred's take\n\n");
        // Synthesis via Claude only (no local model → no fabricated details).
        for await (const chunk of streamAssistant(
          [{ role: "user", content: briefPrompt(state) }],
          {},
          { localFallback: false },
        )) {
          send(chunk);
        }
      } catch (err) {
        send(`\n\n[${(err as Error).message}]`);
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-cache, no-transform" },
  });
}
