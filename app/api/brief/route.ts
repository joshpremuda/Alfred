import { streamBriefing } from "@/lib/claude";
import { buildStateContext } from "@/lib/context";
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
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const chunk of streamBriefing(state)) {
          controller.enqueue(encoder.encode(chunk));
        }
      } catch (err) {
        controller.enqueue(encoder.encode(`\n\n[${(err as Error).message}]`));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-cache, no-transform" },
  });
}
