import { streamAssistant, paperFilterPrompt } from "@/lib/claude";
import { gatherSources, headlinesMarkdown, sourcesForAI } from "@/lib/briefing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (s: string) => controller.enqueue(encoder.encode(s));
      try {
        send("_Reading your sources…_\n\n");
        const sources = await gatherSources();
        const withFeeds = sources.filter((s) => s.headlines.length).length;

        if (!sources.length) {
          send(
            'No sources found. Add news sites to a Chrome bookmarks folder named "Briefing" (or set `BRIEFING_FOLDER`).',
          );
          return;
        }

        // Synthesis first (Claude only — the small local model must not write news).
        const forAI = sourcesForAI(sources);
        if (forAI) {
          send("## The brief\n\n");
          for await (const chunk of streamAssistant(
            [{ role: "user", content: paperFilterPrompt(forAI) }],
            {},
            { localFallback: false },
          )) {
            send(chunk);
          }
          send("\n\n");
        }

        // Then the live headlines by source — accurate and click-through.
        send(`---\n\n## Headlines — ${withFeeds}/${sources.length} sources live\n\n`);
        send(headlinesMarkdown(sources));
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
