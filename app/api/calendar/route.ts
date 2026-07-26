import { upcomingEvents } from "@/lib/calendar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const events = (await upcomingEvents(7)).map((e) => ({
    summary: e.summary,
    start: e.start.toISOString(),
    end: e.end ? e.end.toISOString() : null,
  }));
  return Response.json({ events, configured: events.length > 0 || Boolean(process.env.CALENDAR_ICS_URL || process.env.CALENDAR_ICS_FILE) });
}
