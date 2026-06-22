import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';

export const runtime = 'nodejs';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const db = getDb();
  const body = await req.json();
  const { id } = await params;

  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
  if (!project) return Response.json({ error: 'Not found' }, { status: 404 });

  db.prepare(`
    UPDATE projects
    SET name = ?, status = ?, description = ?, next_actions = ?, updated_at = unixepoch()
    WHERE id = ?
  `).run(
    body.name ?? (project as { name: string }).name,
    body.status ?? (project as { status: string }).status,
    body.description ?? (project as { description: string }).description,
    body.next_actions ? JSON.stringify(body.next_actions) : (project as { next_actions: string }).next_actions,
    id
  );

  const updated = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
  return Response.json({ project: updated });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const db = getDb();
  const { id } = await params;
  db.prepare('DELETE FROM projects WHERE id = ?').run(id);
  return Response.json({ ok: true });
}
