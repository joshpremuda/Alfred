import type { NextRequest } from "next/server";
import { extractUrl } from "@/lib/extract";
import { ingestItem } from "@/lib/ingest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const { url } = await req.json().catch(() => ({ url: undefined }));
  if (!url || typeof url !== "string") {
    return Response.json({ error: "A 'url' is required." }, { status: 400 });
  }
  try {
    const { title, text } = await extractUrl(url);
    if (!text.trim()) {
      return Response.json({ error: "No readable content found at that URL." }, { status: 422 });
    }
    const result = await ingestItem({ type: "url", url, title, text, source: "manual" });
    return Response.json(result);
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
}
