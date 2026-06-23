import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import { BRIEFING_FEEDS } from '@/lib/briefing/feeds';

export const runtime = 'nodejs';

export async function GET() {
  const db = getDb();
  const custom = db.prepare('SELECT * FROM briefing_sources ORDER BY created_at ASC').all();
  return Response.json({ sources: custom, defaults: BRIEFING_FEEDS });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, homepage, rss } = body;
  if (!name || !homepage) {
    return Response.json({ error: 'name and homepage are required' }, { status: 400 });
  }
  const db = getDb();
  const id = uuidv4();
  db.prepare('INSERT INTO briefing_sources (id, name, homepage, rss) VALUES (?, ?, ?, ?)').run(id, name, homepage, rss || null);
  return Response.json({ id, name, homepage, rss });
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json();
  if (!id) return Response.json({ error: 'id required' }, { status: 400 });
  const db = getDb();
  db.prepare('DELETE FROM briefing_sources WHERE id = ?').run(id);
  return Response.json({ ok: true });
}
