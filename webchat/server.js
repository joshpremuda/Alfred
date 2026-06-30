const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const fs = require('fs');
const Anthropic = require('@anthropic-ai/sdk');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.static(path.join(__dirname, 'public')));

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || '';
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';
const AGENT_NAME = process.env.ALFRED_AGENT_NAME || 'Alfred';
const WIKI_PATH = process.env.ALFRED_WIKI_PATH
  ? path.resolve(process.env.ALFRED_WIKI_PATH)
  : path.resolve(__dirname, '..', 'wiki');

if (!ANTHROPIC_KEY) {
  console.error('[Alfred] ANTHROPIC_API_KEY is not set — edit .env and restart');
  process.exit(1);
}

const client = new Anthropic({ apiKey: ANTHROPIC_KEY });

function loadSchema() {
  const schemaPath = path.join(WIKI_PATH, 'CLAUDE.md');
  try {
    return fs.readFileSync(schemaPath, 'utf8');
  } catch {
    return '';
  }
}

function buildSystemPrompt() {
  const schema = loadSchema();
  const base = `You are ${AGENT_NAME}, a capable and loyal personal assistant. You help your owner with tasks, research, writing, scheduling, and anything else they need. You are concise, proactive, and trustworthy.`;
  return schema ? `${base}\n\n---\n\n${schema}` : base;
}

// ── Filesystem tools ──────────────────────────────────────────────────────────

function safePath(userPath) {
  const resolved = path.resolve(WIKI_PATH, userPath);
  if (!resolved.startsWith(WIKI_PATH + path.sep) && resolved !== WIKI_PATH) {
    throw new Error(`Path outside wiki: ${userPath}`);
  }
  return resolved;
}

function toolReadFile({ path: p }) {
  const abs = safePath(p);
  if (!fs.existsSync(abs)) return `File not found: ${p}`;
  return fs.readFileSync(abs, 'utf8');
}

function toolWriteFile({ path: p, content }) {
  const abs = safePath(p);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content, 'utf8');
  return `Written: ${p}`;
}

function toolAppendFile({ path: p, content }) {
  const abs = safePath(p);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.appendFileSync(abs, content, 'utf8');
  return `Appended to: ${p}`;
}

function toolListDirectory({ path: p = '' }) {
  const abs = safePath(p || '.');
  if (!fs.existsSync(abs)) return `Directory not found: ${p}`;
  const entries = fs.readdirSync(abs, { withFileTypes: true });
  return entries
    .map(e => (e.isDirectory() ? `${e.name}/` : e.name))
    .join('\n') || '(empty)';
}

function toolSearchWiki({ query }) {
  const results = [];
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) { walk(full); continue; }
      if (!entry.name.endsWith('.md')) continue;
      const content = fs.readFileSync(full, 'utf8');
      const lines = content.split('\n');
      const rel = path.relative(WIKI_PATH, full);
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].toLowerCase().includes(query.toLowerCase())) {
          results.push(`${rel}:${i + 1}: ${lines[i].trim()}`);
        }
      }
    }
  }
  try { walk(WIKI_PATH); } catch { return 'Search failed'; }
  return results.length ? results.join('\n') : 'No matches found';
}

const TOOLS = [
  {
    name: 'read_file',
    description: 'Read a file from the wiki. Path is relative to wiki root (e.g. "index.md", "entities/openai.md").',
    input_schema: {
      type: 'object',
      properties: { path: { type: 'string', description: 'Relative path within wiki/' } },
      required: ['path'],
    },
  },
  {
    name: 'write_file',
    description: 'Create or overwrite a file in the wiki. Path is relative to wiki root.',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Relative path within wiki/' },
        content: { type: 'string', description: 'Full file content' },
      },
      required: ['path', 'content'],
    },
  },
  {
    name: 'append_to_file',
    description: 'Append text to a file in the wiki (used for log.md and similar).',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Relative path within wiki/' },
        content: { type: 'string', description: 'Text to append' },
      },
      required: ['path', 'content'],
    },
  },
  {
    name: 'list_directory',
    description: 'List files and subdirectories within the wiki. Path is relative to wiki root; omit for root.',
    input_schema: {
      type: 'object',
      properties: { path: { type: 'string', description: 'Relative path within wiki/ (optional)' } },
    },
  },
  {
    name: 'search_wiki',
    description: 'Search all markdown files in the wiki for a query string. Returns file:line matches.',
    input_schema: {
      type: 'object',
      properties: { query: { type: 'string', description: 'Search term' } },
      required: ['query'],
    },
  },
];

function executeTool(name, input) {
  switch (name) {
    case 'read_file':      return toolReadFile(input);
    case 'write_file':     return toolWriteFile(input);
    case 'append_to_file': return toolAppendFile(input);
    case 'list_directory': return toolListDirectory(input);
    case 'search_wiki':    return toolSearchWiki(input);
    default: return `Unknown tool: ${name}`;
  }
}

function toolLabel(name, input) {
  switch (name) {
    case 'read_file':      return `Reading ${input.path}…`;
    case 'write_file':     return `Writing ${input.path}…`;
    case 'append_to_file': return `Updating ${input.path}…`;
    case 'list_directory': return `Listing ${input.path || 'wiki/'}…`;
    case 'search_wiki':    return `Searching for "${input.query}"…`;
    default: return `${name}…`;
  }
}

// ── Agentic loop ──────────────────────────────────────────────────────────────

async function runAgent(history, onToolActivity) {
  const messages = [...history];

  for (let round = 0; round < 20; round++) {
    const response = await client.messages.create({
      model: ANTHROPIC_MODEL,
      max_tokens: 4096,
      system: buildSystemPrompt(),
      tools: TOOLS,
      messages,
    });

    // Collect text from this turn
    const textBlocks = response.content.filter(b => b.type === 'text');
    const toolBlocks = response.content.filter(b => b.type === 'tool_use');

    if (response.stop_reason === 'end_turn' || toolBlocks.length === 0) {
      return textBlocks.map(b => b.text).join('') || '(done)';
    }

    // Push assistant turn
    messages.push({ role: 'assistant', content: response.content });

    // Execute tools
    const toolResults = [];
    for (const block of toolBlocks) {
      onToolActivity(toolLabel(block.name, block.input));
      let result;
      try {
        result = executeTool(block.name, block.input);
      } catch (err) {
        result = `Error: ${err.message}`;
      }
      toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: result });
    }

    messages.push({ role: 'user', content: toolResults });
  }

  return '(reached tool call limit)';
}

// ── WebSocket handler ─────────────────────────────────────────────────────────

console.log(`[Alfred] Model: ${ANTHROPIC_MODEL}`);
console.log(`[Alfred] Wiki:  ${WIKI_PATH}`);

wss.on('connection', (ws) => {
  const history = [];

  ws.send(JSON.stringify({ role: 'system', text: `Connected to ${AGENT_NAME}` }));

  // Silently read hot.md into session context on connect
  try {
    const hot = fs.readFileSync(path.join(WIKI_PATH, 'hot.md'), 'utf8');
    if (hot.trim()) {
      history.push({ role: 'user', content: `[session start — wiki hot cache]\n${hot}` });
      history.push({ role: 'assistant', content: 'Got it. Ready.' });
    }
  } catch { /* no hot.md yet */ }

  ws.on('message', async (raw) => {
    let text;
    try { text = JSON.parse(raw).text; } catch { text = raw.toString(); }
    if (!text) return;

    history.push({ role: 'user', content: text });

    try {
      const reply = await runAgent(history, (activity) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ role: 'system', text: activity }));
        }
      });

      history.push({ role: 'assistant', content: reply });

      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ role: 'agent', text: reply }));
      }
    } catch (err) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ role: 'system', text: `Error: ${err.message}` }));
      }
      history.pop();
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '127.0.0.1', () => {
  console.log(`[Alfred] Web chat at http://localhost:${PORT}`);
});
