import type { NextRequest } from "next/server";
import { listNotifications, unreadCount, markRead, markAllRead } from "@/lib/notifications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const includeRead = req.nextUrl.searchParams.get("all") === "1";
  return Response.json({
    notifications: listNotifications(includeRead),
    unread: unreadCount(),
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  if (body?.all) markAllRead();
  else if (typeof body?.id === "number") markRead(body.id);
  else return Response.json({ error: "Provide { id } or { all: true }." }, { status: 400 });
  return Response.json({ unread: unreadCount() });
}
