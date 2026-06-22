import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';

export const runtime = 'nodejs';

export async function PUT(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const db = getDb();
  const { id } = await params;
  db.prepare('UPDATE notifications SET read = 1 WHERE id = ?').run(id);
  return Response.json({ ok: true });
}
