import type { NextRequest } from "next/server";
import { ingestItem } from "@/lib/ingest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const { text, title } = await req.json().catch(() => ({ text: undefined }));
  if (!text || typeof text !== "string" || !text.trim()) {
    return Response.json({ error: "A 'text' body is required." }, { status: 400 });
  }
  try {
    const result = await ingestItem({
      type: "note",
      text: text.trim(),
      title: typeof title === "string" ? title : undefined,
      source: "manual",
    });
    return Response.json(result);
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
}
