import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

export const runtime = 'nodejs';

export async function GET() {
  const db = getDb();
  const collections = db.prepare('SELECT * FROM collections ORDER BY name ASC').all();

  const withCounts = (collections as Array<{ id: string; name: string; description: string; color: string; created_at: number }>).map((c) => {
    const count = (db.prepare('SELECT COUNT(*) as count FROM collection_items WHERE collection_id = ?').get(c.id) as { count: number }).count;
    return { ...c, itemCount: count };
  });

  return Response.json({ collections: withCounts });
}

export async function POST(req: NextRequest) {
  const db = getDb();
  const body = await req.json();
  if (!body.name) return Response.json({ error: 'Name required' }, { status: 400 });

  const id = uuidv4();
  db.prepare('INSERT INTO collections (id, name, description, color) VALUES (?, ?, ?, ?)').run(
    id, body.name, body.description || '', body.color || '#6B7280'
  );

  const collection = db.prepare('SELECT * FROM collections WHERE id = ?').get(id);
  return Response.json({ collection }, { status: 201 });
}
