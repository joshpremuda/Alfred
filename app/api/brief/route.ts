import { streamAssistant, briefPrompt } from "@/lib/claude";
import { buildStateContext, buildDigest } from "@/lib/context";
import { enrichBriefingBookmarks, readingSection, readingForAI } from "@/lib/briefing";
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
        // 1) Projects/calendar digest — instant, no network or AI.
        send(digest + "\n");

        // 2) Fetch + read the Briefing sources, then show a click-through list.
        send("_Reading your sources…_\n\n");
        const items = await enrichBriefingBookmarks();
        send(readingSection(items));

        // 3) The Paper Filter synthesis (Claude if credits, else local model).
        send("---\n\n### The brief\n\n");
        const sources = readingForAI(items);
        const aiState = sources ? `${state}\n\nSOURCES (full text):\n\n${sources}` : state;
        for await (const chunk of streamAssistant([{ role: "user", content: briefPrompt(aiState) }])) {
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
