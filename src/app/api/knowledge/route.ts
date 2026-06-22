import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { extractUrl } from '@/lib/ingest';
import { v4 as uuidv4 } from 'uuid';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const db = getDb();
  const { searchParams } = new URL(req.url);
  const limit = parseInt(searchParams.get('limit') || '50');
  const offset = parseInt(searchParams.get('offset') || '0');

  const items = db.prepare(
    'SELECT id, type, title, source, substr(content, 1, 200) as excerpt, created_at FROM knowledge_items ORDER BY created_at DESC LIMIT ? OFFSET ?'
  ).all(limit, offset);

  const total = (db.prepare('SELECT COUNT(*) as count FROM knowledge_items').get() as { count: number }).count;

  return Response.json({ items, total });
}

export async function POST(req: NextRequest) {
  const db = getDb();
  const body = await req.json();

  if (body.url) {
    try {
      const { title, content } = await extractUrl(body.url);
      const id = uuidv4();
      db.prepare(
        'INSERT INTO knowledge_items (id, type, title, content, source) VALUES (?, ?, ?, ?, ?)'
      ).run(id, 'url', title, content, body.url);

      const item = db.prepare('SELECT * FROM knowledge_items WHERE id = ?').get(id);
      return Response.json({ item }, { status: 201 });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch URL';
      return Response.json({ error: msg }, { status: 400 });
    }
  }

  if (body.title && body.content) {
    const id = uuidv4();
    db.prepare(
      'INSERT INTO knowledge_items (id, type, title, content, source, metadata) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(id, body.type || 'note', body.title, body.content, body.source || null, JSON.stringify(body.metadata || {}));

    const item = db.prepare('SELECT * FROM knowledge_items WHERE id = ?').get(id);
    return Response.json({ item }, { status: 201 });
  }

  return Response.json({ error: 'Provide url or title+content' }, { status: 400 });
}

export async function DELETE(req: NextRequest) {
  const db = getDb();
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return Response.json({ error: 'Missing id' }, { status: 400 });

  db.prepare('DELETE FROM knowledge_items WHERE id = ?').run(id);
  return Response.json({ ok: true });
}
