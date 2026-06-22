import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { extractText, saveUploadedFile } from '@/lib/ingest';
import { v4 as uuidv4 } from 'uuid';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const db = getDb();

  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  if (!file) return Response.json({ error: 'No file provided' }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());
  const filePath = saveUploadedFile(buffer, file.name);

  let content = '';
  try {
    content = await extractText(filePath, file.type);
  } catch {
    content = `[Binary file: ${file.name}]`;
  }

  const id = uuidv4();
  const title = file.name.replace(/\.[^.]+$/, '');

  db.prepare(
    'INSERT INTO knowledge_items (id, type, title, content, source, metadata) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(
    id,
    'document',
    title,
    content,
    filePath,
    JSON.stringify({ originalName: file.name, mimeType: file.type, size: file.size })
  );

  const item = db.prepare('SELECT id, type, title, source, created_at FROM knowledge_items WHERE id = ?').get(id);
  return Response.json({ item }, { status: 201 });
}
