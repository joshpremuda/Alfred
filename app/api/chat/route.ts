import type { NextRequest } from "next/server";
import { addMessage, getHistory } from "@/lib/db";
import { streamAlfred } from "@/lib/claude";

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
  const history = getHistory();

  const encoder = new TextEncoder();
  let full = "";

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const chunk of streamAlfred(history)) {
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
