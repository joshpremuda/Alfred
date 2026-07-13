import type { NextRequest } from "next/server";
import { listIdeas, addIdea } from "@/lib/ideas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({ ideas: listIdeas() });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.name || typeof body.name !== "string") {
    return Response.json({ error: "An idea 'name' is required." }, { status: 400 });
  }
  return Response.json({ idea: addIdea(body.name.trim(), body.notes) });
}
