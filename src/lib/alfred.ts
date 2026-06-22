import Anthropic from '@anthropic-ai/sdk';
import { getDb } from './db';

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';

const SYSTEM_PROMPT = `You are Alfred — the personal Chief of Staff and second brain for Josh Premuda.

PERSONALITY
You are calm, intelligent, organized, and editorial. You prioritize information rather than dumping it. You make recommendations. You are minimal and helpful without being annoying. Think: a brilliant executive assistant who has read everything, remembers everything, and always knows what matters most.

OWNER PROFILE
Josh Premuda is an entrepreneur and operator.
- Active businesses: Smalley Coffee (specialty coffee brand)
- Projects in development: Crema, Paper Filter, Digital Caddie Book, Clubsmanship
- Goals: build recurring income, grow Smalley Coffee, create media properties, build AI-leveraged systems
- Aesthetic preferences: Monocle magazine, Arc Browser, Linear, minimal/editorial design
- Values: quality, craft, intelligent systems, calm productivity

BEHAVIOR GUIDELINES
- Be concise and direct. No filler phrases ("Great question!", "Certainly!", "Of course!").
- Lead with the most important insight, not background context.
- When asked "what should I work on?", give one clear recommendation with brief reasoning.
- When briefing, be concise — surface what matters, skip what doesn't.
- Proactively notice connections between projects, ideas, and saved content when relevant.
- Use markdown for structure when it helps readability.
- When you search knowledge or retrieve data, synthesize it — don't just quote it back.

CURRENT CONTEXT
You have access to Josh's knowledge vault, projects, and ideas through tool calls. Use them to give grounded, specific answers rather than generic ones.

DATE: ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`;

export const ALFRED_TOOLS: Anthropic.Tool[] = [
  {
    name: 'search_knowledge',
    description: 'Search the knowledge vault for relevant articles, documents, notes, and URLs. Use this when Josh asks about a topic or when context from saved content would be helpful.',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: { type: 'string', description: 'Search query' },
        limit: { type: 'number', description: 'Max results (default 5)' },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_projects',
    description: 'Retrieve projects from the project tracker. Use when asked about project status, what\'s active, what\'s stalled, or when preparing a briefing.',
    input_schema: {
      type: 'object' as const,
      properties: {
        status: { type: 'string', enum: ['active', 'stalled', 'paused', 'complete', 'all'], description: 'Filter by status (default: all)' },
      },
    },
  },
  {
    name: 'get_ideas',
    description: 'Retrieve the idea reservoir. Use when asked about ideas, creative projects, or when looking for connections.',
    input_schema: {
      type: 'object' as const,
      properties: {},
    },
  },
  {
    name: 'get_notifications',
    description: 'Get pending notifications and items worth attention.',
    input_schema: {
      type: 'object' as const,
      properties: {},
    },
  },
  {
    name: 'save_to_knowledge',
    description: 'Save a note or piece of information to the knowledge vault.',
    input_schema: {
      type: 'object' as const,
      properties: {
        title: { type: 'string', description: 'Title for this knowledge item' },
        content: { type: 'string', description: 'The content to save' },
        type: { type: 'string', enum: ['note', 'idea', 'reference'], description: 'Type of content' },
      },
      required: ['title', 'content'],
    },
  },
  {
    name: 'create_project',
    description: 'Create a new project in the project tracker.',
    input_schema: {
      type: 'object' as const,
      properties: {
        name: { type: 'string', description: 'Project name' },
        description: { type: 'string', description: 'Project description' },
        next_actions: { type: 'array', items: { type: 'string' }, description: 'Initial next actions' },
      },
      required: ['name'],
    },
  },
  {
    name: 'create_idea',
    description: 'Add an idea to the idea reservoir.',
    input_schema: {
      type: 'object' as const,
      properties: {
        title: { type: 'string', description: 'Idea title' },
        description: { type: 'string', description: 'Idea description' },
      },
      required: ['title'],
    },
  },
];

export async function runTool(toolName: string, input: Record<string, unknown>): Promise<string> {
  const db = getDb();

  switch (toolName) {
    case 'search_knowledge': {
      const query = input.query as string;
      const limit = (input.limit as number) || 5;
      try {
        const rows = db.prepare(`
          SELECT ki.id, ki.title, ki.type, ki.source,
                 substr(ki.content, 1, 500) as excerpt
          FROM knowledge_fts
          JOIN knowledge_items ki ON ki.rowid = knowledge_fts.rowid
          WHERE knowledge_fts MATCH ?
          LIMIT ?
        `).all(query, limit);
        if (!rows.length) return 'No results found in knowledge vault.';
        return JSON.stringify(rows, null, 2);
      } catch {
        const rows = db.prepare(`
          SELECT id, title, type, source, substr(content, 1, 300) as excerpt
          FROM knowledge_items
          WHERE title LIKE ? OR content LIKE ?
          LIMIT ?
        `).all(`%${query}%`, `%${query}%`, limit);
        if (!rows.length) return 'No results found.';
        return JSON.stringify(rows, null, 2);
      }
    }

    case 'get_projects': {
      const status = input.status as string || 'all';
      const rows = status === 'all'
        ? db.prepare('SELECT * FROM projects ORDER BY updated_at DESC').all()
        : db.prepare('SELECT * FROM projects WHERE status = ? ORDER BY updated_at DESC').all(status);
      return rows.length ? JSON.stringify(rows, null, 2) : 'No projects found.';
    }

    case 'get_ideas': {
      const rows = db.prepare('SELECT * FROM ideas ORDER BY created_at DESC').all();
      return rows.length ? JSON.stringify(rows, null, 2) : 'No ideas in the reservoir.';
    }

    case 'get_notifications': {
      const rows = db.prepare("SELECT * FROM notifications WHERE read = 0 ORDER BY created_at DESC LIMIT 20").all();
      return rows.length ? JSON.stringify(rows, null, 2) : 'No pending notifications.';
    }

    case 'save_to_knowledge': {
      const { v4: uuidv4 } = await import('uuid');
      const id = uuidv4();
      db.prepare(`
        INSERT INTO knowledge_items (id, type, title, content)
        VALUES (?, ?, ?, ?)
      `).run(id, input.type || 'note', input.title, input.content);
      return `Saved to knowledge vault with id: ${id}`;
    }

    case 'create_project': {
      const { v4: uuidv4 } = await import('uuid');
      const id = uuidv4();
      db.prepare(`
        INSERT INTO projects (id, name, description, next_actions)
        VALUES (?, ?, ?, ?)
      `).run(id, input.name, input.description || '', JSON.stringify(input.next_actions || []));
      return `Project "${input.name}" created with id: ${id}`;
    }

    case 'create_idea': {
      const { v4: uuidv4 } = await import('uuid');
      const id = uuidv4();
      db.prepare(`
        INSERT INTO ideas (id, title, description)
        VALUES (?, ?, ?)
      `).run(id, input.title, input.description || '');
      return `Idea "${input.title}" added to reservoir with id: ${id}`;
    }

    default:
      return `Unknown tool: ${toolName}`;
  }
}

export async function* streamAlfredResponse(
  messages: Anthropic.MessageParam[],
): AsyncGenerator<string> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const currentMessages = [...messages];

  while (true) {
    const stream = client.messages.stream({
      model: MODEL,
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      tools: ALFRED_TOOLS,
      messages: currentMessages,
    });

    let accumulatedText = '';
    let stopReason: string | null = null;
    const toolUseBlocks: Anthropic.ToolUseBlock[] = [];

    for await (const event of stream) {
      if (event.type === 'content_block_delta') {
        if (event.delta.type === 'text_delta') {
          accumulatedText += event.delta.text;
          yield event.delta.text;
        }
      } else if (event.type === 'message_delta') {
        stopReason = event.delta.stop_reason ?? null;
      } else if (event.type === 'content_block_stop') {
        // handled below via message
      }
    }

    const finalMessage = await stream.finalMessage();
    stopReason = finalMessage.stop_reason;

    for (const block of finalMessage.content) {
      if (block.type === 'tool_use') {
        toolUseBlocks.push(block);
      }
    }

    if (stopReason !== 'tool_use' || toolUseBlocks.length === 0) break;

    currentMessages.push({ role: 'assistant', content: finalMessage.content });

    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const toolUse of toolUseBlocks) {
      yield `\n\n*[Checking ${toolUse.name.replace(/_/g, ' ')}...]*\n\n`;
      const result = await runTool(toolUse.name, toolUse.input as Record<string, unknown>);
      toolResults.push({
        type: 'tool_result',
        tool_use_id: toolUse.id,
        content: result,
      });
    }

    currentMessages.push({ role: 'user', content: toolResults });
  }
}

export async function generateBrief(): Promise<string> {
  const db = getDb();

  const projects = db.prepare("SELECT * FROM projects WHERE status IN ('active', 'stalled') ORDER BY status, updated_at DESC").all() as Array<{name: string; status: string; next_actions: string; updated_at: number}>;
  const ideas = db.prepare("SELECT title, status FROM ideas ORDER BY created_at DESC LIMIT 10").all() as Array<{title: string; status: string}>;
  const notifications = db.prepare("SELECT * FROM notifications WHERE read = 0 ORDER BY created_at DESC").all() as Array<{title: string; body: string}>;
  const recentKnowledge = db.prepare("SELECT title, type, created_at FROM knowledge_items ORDER BY created_at DESC LIMIT 5").all() as Array<{title: string; type: string}>;

  const context = `
PROJECTS:
${projects.map(p => `- ${p.name} [${p.status}] — Next: ${JSON.parse(p.next_actions || '[]').slice(0, 1).join(', ') || 'none defined'}`).join('\n') || 'No active projects'}

PENDING NOTIFICATIONS:
${notifications.map(n => `- ${n.title}: ${n.body}`).join('\n') || 'None'}

RECENTLY SAVED:
${recentKnowledge.map(k => `- "${k.title}" (${k.type})`).join('\n') || 'Nothing recently saved'}

IDEAS RESERVOIR (top 5):
${ideas.slice(0, 5).map(i => `- ${i.title} [${i.status}]`).join('\n')}
`;

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: `Generate a concise executive briefing for today. Be editorial — surface what matters most, skip what doesn't. Lead with the most important item. Keep it scannable. Here is the current context:\n\n${context}`,
      },
    ],
  });

  return msg.content[0]?.type === 'text' ? msg.content[0].text : 'Unable to generate briefing.';
}
