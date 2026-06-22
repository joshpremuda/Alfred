import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

export const runtime = 'nodejs';

export async function GET() {
  const db = getDb();
  const ideas = db.prepare('SELECT * FROM ideas ORDER BY created_at DESC').all();
  return Response.json({ ideas });
}

export async function POST(req: NextRequest) {
  const db = getDb();
  const body = await req.json();
  if (!body.title) return Response.json({ error: 'Title required' }, { status: 400 });

  const id = uuidv4();
  db.prepare(`
    INSERT INTO ideas (id, title, description, status, notes)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, body.title, body.description || '', body.status || 'raw', body.notes || '');

  const idea = db.prepare('SELECT * FROM ideas WHERE id = ?').get(id);
  return Response.json({ idea }, { status: 201 });
}

export async function PUT(req: NextRequest) {
  const db = getDb();
  const body = await req.json();
  if (!body.id) return Response.json({ error: 'ID required' }, { status: 400 });

  db.prepare(`
    UPDATE ideas SET title = ?, description = ?, status = ?, notes = ?, updated_at = unixepoch()
    WHERE id = ?
  `).run(body.title, body.description || '', body.status || 'raw', body.notes || '', body.id);

  const idea = db.prepare('SELECT * FROM ideas WHERE id = ?').get(body.id);
  return Response.json({ idea });
}
