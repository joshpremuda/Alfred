import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { streamAlfredResponse } from '@/lib/alfred';
import { v4 as uuidv4 } from 'uuid';
import type Anthropic from '@anthropic-ai/sdk';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const { message, conversationId } = await req.json();
  if (!message) return new Response('Missing message', { status: 400 });

  const db = getDb();
  const convId = conversationId || uuidv4();

  if (!conversationId) {
    db.prepare('INSERT INTO conversations (id, title) VALUES (?, ?)').run(
      convId,
      message.slice(0, 60)
    );
  } else {
    db.prepare('UPDATE conversations SET updated_at = unixepoch() WHERE id = ?').run(convId);
  }

  const msgId = uuidv4();
  db.prepare('INSERT INTO messages (id, conversation_id, role, content) VALUES (?, ?, ?, ?)').run(
    msgId, convId, 'user', message
  );

  const history = db.prepare(
    'SELECT role, content FROM messages WHERE conversation_id = ? ORDER BY created_at ASC'
  ).all(convId) as { role: string; content: string }[];

  const anthropicMessages: Anthropic.MessageParam[] = history.map(m => ({
    role: m.role as 'user' | 'assistant',
    content: m.content,
  }));

  const encoder = new TextEncoder();
  let fullResponse = '';

  const stream = new ReadableStream({
    async start(controller) {
      try {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ conversationId: convId })}\n\n`));

        for await (const chunk of streamAlfredResponse(anthropicMessages)) {
          fullResponse += chunk;
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: chunk })}\n\n`));
        }

        const assistantId = uuidv4();
        db.prepare('INSERT INTO messages (id, conversation_id, role, content) VALUES (?, ?, ?, ?)').run(
          assistantId, convId, 'assistant', fullResponse
        );

        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`));
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : 'Unknown error';
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: errMsg })}\n\n`));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}

export async function GET(req: NextRequest) {
  const db = getDb();
  const { searchParams } = new URL(req.url);
  const conversationId = searchParams.get('conversationId');

  if (conversationId) {
    const messages = db.prepare(
      'SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC'
    ).all(conversationId);
    return Response.json({ messages });
  }

  const conversations = db.prepare(
    'SELECT * FROM conversations ORDER BY updated_at DESC LIMIT 50'
  ).all();
  return Response.json({ conversations });
}
