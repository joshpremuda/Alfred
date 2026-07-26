import type { NextRequest } from "next/server";
import { listProjects, upsertProject, detectStalled } from "@/lib/projects";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  detectStalled();
  return Response.json({ projects: listProjects() });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.name || typeof body.name !== "string") {
    return Response.json({ error: "A project 'name' is required." }, { status: 400 });
  }
  const project = upsertProject({
    name: body.name.trim(),
    status: body.status,
    notes: body.notes,
    next_action: body.next_action,
  });
  return Response.json({ project });
}
