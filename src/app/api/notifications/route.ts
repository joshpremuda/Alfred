import { getDb } from '@/lib/db';

export const runtime = 'nodejs';

export async function GET() {
  const db = getDb();
  const notifications = db.prepare(
    'SELECT * FROM notifications ORDER BY created_at DESC LIMIT 50'
  ).all();
  const unreadCount = (db.prepare("SELECT COUNT(*) as count FROM notifications WHERE read = 0").get() as { count: number }).count;
  return Response.json({ notifications, unreadCount });
}
