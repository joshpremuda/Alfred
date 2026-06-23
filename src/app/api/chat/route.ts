import { NextRequest } from 'next/server';
import { getDb } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import Anthropic from '@anthropic-ai/sdk';
import { ALFRED_TOOLS, runTool } from '@/lib/alfred';

export const runtime = 'nodejs';

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';

function getSystemPrompt() {
  return `You are Alfred — the personal Chief of Staff and second brain for Josh Premuda.

PERSONALITY
You are calm, intelligent, organized, and editorial. You prioritize information rather than dumping it. You make recommendations. You are minimal and helpful without being annoying. Think: a brilliant executive assistant who has read everything, remembers everything, and always knows what matters most.

OWNER PROFILE
Josh Premuda is an entrepreneur and operator.
- Active businesses: Smalley Coffee (specialty coffee brand)
- Projects in development: Crema, Paper Filter, Digital Caddie Book, Clubsmanship
- Goals: build recurring income, grow Smalley Coffee, create media properties, build AI-leveraged systems
- Aesthetic preferences: Monocle magazine, Arc Browser, Linear, minimal/editorial design

BEHAVIOR GUIDELINES
- Be concise and direct. No filler phrases.
- Lead with the most important insight.
- When asked "what should I work on?", give one clear recommendation with brief reasoning.
- Use markdown for structure when it helps readability.
- When you use tools, synthesize the results — don't just quote them back.

DATE: ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`;
}

async function getAlfredResponse(messages: Anthropic.MessageParam[]): Promise<string> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const currentMessages = [...messages];

  for (let i = 0; i < 5; i++) {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 4096,
      system: getSystemPrompt(),
      tools: ALFRED_TOOLS,
      messages: currentMessages,
    });

    if (response.stop_reason !== 'tool_use') {
      const textBlock = response.content.find(b => b.type === 'text');
      return textBlock?.type === 'text' ? textBlock.text : 'No response.';
    }

    currentMessages.push({ role: 'assistant', content: response.content });

    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const block of response.content) {
      if (block.type === 'tool_use') {
        const result = await runTool(block.name, block.input as Record<string, unknown>);
        toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: result });
      }
    }
    currentMessages.push({ role: 'user', content: toolResults });
  }

  return 'Something went wrong processing your request.';
}

export async function POST(req: NextRequest) {
  try {
    const { message, conversationId } = await req.json();
    if (!message) return Response.json({ error: 'Missing message' }, { status: 400 });

    const db = getDb();
    const convId = conversationId || uuidv4();

    if (!conversationId) {
      db.prepare('INSERT INTO conversations (id, title) VALUES (?, ?)').run(convId, message.slice(0, 60));
    } else {
      db.prepare('UPDATE conversations SET updated_at = unixepoch() WHERE id = ?').run(convId);
    }

    db.prepare('INSERT INTO messages (id, conversation_id, role, content) VALUES (?, ?, ?, ?)').run(
      uuidv4(), convId, 'user', message
    );

    const history = db.prepare(
      'SELECT role, content FROM messages WHERE conversation_id = ? ORDER BY created_at ASC'
    ).all(convId) as { role: string; content: string }[];

    const anthropicMessages: Anthropic.MessageParam[] = history.map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));

    const reply = await getAlfredResponse(anthropicMessages);

    db.prepare('INSERT INTO messages (id, conversation_id, role, content) VALUES (?, ?, ?, ?)').run(
      uuidv4(), convId, 'assistant', reply
    );

    return Response.json({ reply, conversationId: convId });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    console.error('[Alfred] Chat error:', msg);
    return Response.json({ error: msg }, { status: 500 });
  }
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
