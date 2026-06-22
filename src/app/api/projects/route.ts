import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

export const runtime = 'nodejs';

export async function GET() {
  const db = getDb();
  const projects = db.prepare('SELECT * FROM projects ORDER BY status ASC, updated_at DESC').all();
  return Response.json({ projects });
}

export async function POST(req: NextRequest) {
  const db = getDb();
  const body = await req.json();
  if (!body.name) return Response.json({ error: 'Name required' }, { status: 400 });

  const id = uuidv4();
  db.prepare(`
    INSERT INTO projects (id, name, status, description, next_actions)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    id,
    body.name,
    body.status || 'active',
    body.description || '',
    JSON.stringify(body.next_actions || [])
  );

  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
  return Response.json({ project }, { status: 201 });
}
