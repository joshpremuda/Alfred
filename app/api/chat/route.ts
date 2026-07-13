import type { NextRequest } from "next/server";
import { addMessage, getHistory } from "@/lib/db";
import { streamAlfred } from "@/lib/claude";
import { search, assembleContext } from "@/lib/retrieval";
import { buildStateContext } from "@/lib/context";

// better-sqlite3 + the Anthropic SDK need the Node runtime.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let message: string;
  try {
    ({ message } = await req.json());
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }
  if (!message || !message.trim()) {
    return new Response("Empty message", { status: 400 });
  }

  addMessage("user", message.trim());

  // Ground the reply in retrieved notes + a snapshot of Josh's world.
  // Any failure here (e.g. embedding model not yet available) is non-fatal.
  let notes: string | undefined;
  try {
    const hits = (await search(message.trim(), 5)).filter((h) => h.score > 0.25);
    if (hits.length) notes = assembleContext(hits);
  } catch (err) {
    console.warn("[chat] retrieval skipped:", (err as Error).message);
  }
  let state: string | undefined;
  try {
    state = (await buildStateContext()) || undefined;
  } catch (err) {
    console.warn("[chat] state context skipped:", (err as Error).message);
  }

  const history = getHistory();
  const encoder = new TextEncoder();
  let full = "";

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const chunk of streamAlfred(history, { notes, state })) {
          full += chunk;
          controller.enqueue(encoder.encode(chunk));
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        controller.enqueue(encoder.encode(`\n\n[${msg}]`));
      } finally {
        if (full.trim()) addMessage("assistant", full);
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
    },
  });
}
