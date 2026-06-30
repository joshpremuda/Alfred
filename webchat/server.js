const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const thoughts = require('./thoughts');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.2';
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || '';
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';
const AGENT_NAME = process.env.ALFRED_AGENT_NAME || 'Alfred';

const BACKEND = ANTHROPIC_KEY ? 'anthropic' : 'ollama';
console.log(`[Alfred] Backend: ${BACKEND === 'anthropic' ? `Anthropic (${ANTHROPIC_MODEL})` : `Ollama (${OLLAMA_MODEL} @ ${OLLAMA_HOST})`}`);

// ── Thought REST API ───────────────────────────────────────────────────────────

app.post('/api/thoughts', (req, res) => {
  const { content, tags, source, links } = req.body;
  if (!content?.trim()) return res.status(400).json({ error: 'content required' });
  const t = thoughts.capture({ content: content.trim(), tags, source, links });
  broadcastThought(t);
  res.json(t);
});

app.get('/api/thoughts', (req, res) => {
  const { q, tags, status, limit } = req.query;
  res.json(thoughts.search({
    query: q,
    tags: tags ? tags.split(',') : undefined,
    status,
    limit: limit ? parseInt(limit) : 20,
  }));
});

app.patch('/api/thoughts/:id', (req, res) => {
  const t = thoughts.update(req.params.id, req.body);
  if (!t) return res.status(404).json({ error: 'not found' });
  broadcastThought(t, 'thought_updated');
  res.json(t);
});

app.post('/api/thoughts/:id/link', (req, res) => {
  const { targetId } = req.body;
  const ok = thoughts.linkThoughts(req.params.id, targetId);
  if (!ok) return res.status(404).json({ error: 'one or both thoughts not found' });
  res.json({ ok: true });
});

// ── System prompt ──────────────────────────────────────────────────────────────

function buildSystemPrompt() {
  return `You are ${AGENT_NAME}, a capable and loyal personal AI chief of staff. You help your owner capture thoughts, manage tasks, do research, and execute plans.

## Thought Capture
When the user shares a thought, idea, reminder, or resource, ALWAYS save it using the capture_thought tool before responding. Do not ask for permission — just save it, then acknowledge briefly.

## Tool Instructions
You have access to the following tools. Invoke them when relevant:

### capture_thought
Save a thought, idea, note, task, or resource the user mentions.
Arguments: { "content": "...", "tags": ["tag1"], "links": [] }

### recall_thoughts
Search and retrieve thoughts to synthesize or act on.
Arguments: { "query": "...", "tags": ["tag1"], "status": "raw|actioned|archived", "limit": 10 }

### update_thought
Update the status or tags of a thought by id.
Arguments: { "id": "...", "status": "actioned|archived", "tags": ["..."] }

## Behavior
- Be concise. One line for acknowledgments.
- When asked to "recall", "find", "synthesize", or "what did I say about X", use recall_thoughts.
- When the user says "do that", "execute", "add to calendar", "remind me", etc., update the thought status to "actioned" and describe what you did or would do.
- Group related thoughts and surface connections when synthesizing.`;
}

// ── Tool execution ─────────────────────────────────────────────────────────────

function executeTool(name, input) {
  if (name === 'capture_thought') {
    const t = thoughts.capture({
      content: input.content,
      tags: input.tags || [],
      source: input.source || 'alfred',
      links: input.links || [],
    });
    broadcastThought(t);
    return JSON.stringify(t);
  }
  if (name === 'recall_thoughts') {
    return thoughts.digest({
      query: input.query,
      tags: input.tags,
      status: input.status,
      limit: input.limit || 20,
    });
  }
  if (name === 'update_thought') {
    const patch = {};
    if (input.status) patch.status = input.status;
    if (input.tags) patch.tags = input.tags;
    const t = thoughts.update(input.id, patch);
    if (!t) return 'Thought not found.';
    broadcastThought(t, 'thought_updated');
    return JSON.stringify(t);
  }
  return 'Unknown tool.';
}

const TOOLS = [
  {
    name: 'capture_thought',
    description: 'Save a thought, idea, note, task, or resource the user expresses.',
    input_schema: {
      type: 'object',
      properties: {
        content: { type: 'string', description: 'The full thought or idea text.' },
        tags: { type: 'array', items: { type: 'string' }, description: 'Relevant topic tags.' },
        links: { type: 'array', items: { type: 'string' }, description: 'IDs of related thoughts.' },
      },
      required: ['content'],
    },
  },
  {
    name: 'recall_thoughts',
    description: 'Search and retrieve saved thoughts for synthesis or action.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Keyword or topic to search for.' },
        tags: { type: 'array', items: { type: 'string' } },
        status: { type: 'string', enum: ['raw', 'actioned', 'archived'] },
        limit: { type: 'number' },
      },
    },
  },
  {
    name: 'update_thought',
    description: 'Update the status or tags of a saved thought.',
    input_schema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        status: { type: 'string', enum: ['raw', 'actioned', 'archived'] },
        tags: { type: 'array', items: { type: 'string' } },
      },
      required: ['id'],
    },
  },
];

// ── LLM backends ───────────────────────────────────────────────────────────────

async function chatOllama(history) {
  const res = await fetch(`${OLLAMA_HOST}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      messages: [{ role: 'system', content: buildSystemPrompt() }, ...history],
      stream: false,
    }),
  });
  if (!res.ok) throw new Error(`Ollama ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.message?.content || '(no response)';
}

async function chatAnthropic(history) {
  const Anthropic = require('@anthropic-ai/sdk');
  const client = new Anthropic.default({ apiKey: ANTHROPIC_KEY });

  let messages = [...history];

  // Agentic loop — keep going until no more tool calls
  for (let i = 0; i < 8; i++) {
    const response = await client.messages.create({
      model: ANTHROPIC_MODEL,
      max_tokens: 1024,
      system: buildSystemPrompt(),
      tools: TOOLS,
      messages,
    });

    if (response.stop_reason === 'tool_use') {
      messages.push({ role: 'assistant', content: response.content });
      const toolResults = [];
      for (const block of response.content) {
        if (block.type === 'tool_use') {
          const result = executeTool(block.name, block.input);
          toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: result });
        }
      }
      messages.push({ role: 'user', content: toolResults });
      continue;
    }

    return response.content.find(b => b.type === 'text')?.text || '(no response)';
  }

  return 'Done.';
}

// ── WebSocket ──────────────────────────────────────────────────────────────────

const clients = new Set();

function broadcastThought(thought, event = 'thought_captured') {
  const msg = JSON.stringify({ type: event, thought });
  for (const ws of clients) {
    if (ws.readyState === WebSocket.OPEN) ws.send(msg);
  }
}

wss.on('connection', (ws) => {
  clients.add(ws);
  const history = [];
  const backend = BACKEND === 'anthropic'
    ? `Anthropic / ${ANTHROPIC_MODEL}`
    : `Ollama / ${OLLAMA_MODEL}`;

  ws.send(JSON.stringify({ type: 'system', role: 'system', text: `Connected to ${AGENT_NAME} (${backend})` }));

  // Send recent thoughts on connect so the UI can populate the sidebar
  const recent = thoughts.search({ limit: 20 });
  ws.send(JSON.stringify({ type: 'thoughts_init', thoughts: recent }));

  ws.on('message', async (raw) => {
    let text;
    try { text = JSON.parse(raw).text; } catch { text = raw.toString(); }
    if (!text) return;

    history.push({ role: 'user', content: text });

    try {
      const reply = BACKEND === 'anthropic'
        ? await chatAnthropic(history)
        : await chatOllama(history);

      history.push({ role: 'assistant', content: reply });

      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'message', role: 'agent', text: reply }));
      }
    } catch (err) {
      if (ws.readyState === WebSocket.OPEN) {
        const hint = BACKEND === 'ollama'
          ? `Could not reach Ollama at ${OLLAMA_HOST} — start it with: ollama serve`
          : `Anthropic API error: ${err.message}`;
        ws.send(JSON.stringify({ type: 'system', role: 'system', text: hint }));
      }
      history.pop();
    }
  });

  ws.on('close', () => clients.delete(ws));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`[Alfred] Web chat at http://localhost:${PORT}`);
});
