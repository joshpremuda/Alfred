import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const db = getDb();
  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q') || '';
  const limit = parseInt(searchParams.get('limit') || '20');

  if (!q.trim()) return Response.json({ results: [] });

  try {
    const results = db.prepare(`
      SELECT ki.id, ki.title, ki.type, ki.source, ki.created_at,
             snippet(knowledge_fts, 1, '<mark>', '</mark>', '…', 20) as excerpt
      FROM knowledge_fts
      JOIN knowledge_items ki ON ki.rowid = knowledge_fts.rowid
      WHERE knowledge_fts MATCH ?
      ORDER BY rank
      LIMIT ?
    `).all(q, limit);
    return Response.json({ results });
  } catch {
    const results = db.prepare(`
      SELECT id, title, type, source, created_at,
             substr(content, 1, 300) as excerpt
      FROM knowledge_items
      WHERE title LIKE ? OR content LIKE ?
      LIMIT ?
    `).all(`%${q}%`, `%${q}%`, limit);
    return Response.json({ results });
  }
}
