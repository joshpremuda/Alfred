import type { NextRequest } from "next/server";
import { searchItems } from "@/lib/retrieval";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (!q) return Response.json({ results: [] });
  try {
    return Response.json({ results: await searchItems(q) });
  } catch (err) {
    return Response.json({ error: (err as Error).message, results: [] }, { status: 500 });
  }
}
