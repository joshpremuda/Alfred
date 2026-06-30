const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const fs = require('fs');
const { makeClient, makeWikiTools, runAgent } = require('../lib/tools.js');

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

const client = makeClient(ANTHROPIC_KEY);
const tools = makeWikiTools(WIKI_PATH);

function readWikiFile(name) {
  try { return fs.readFileSync(path.join(WIKI_PATH, name), 'utf8'); } catch { return ''; }
}

function buildSystemPrompt() {
  const base = `You are ${AGENT_NAME}, a capable and loyal personal assistant. You help your owner with tasks, research, writing, scheduling, and anything else they need. You are concise, proactive, and trustworthy.`;
  const schema = readWikiFile('CLAUDE.md');
  const profile = readWikiFile('profile.md');
  return [base, schema, profile].filter(Boolean).join('\n\n---\n\n');
}

console.log(`[Alfred] Model: ${ANTHROPIC_MODEL}`);
console.log(`[Alfred] Wiki:  ${WIKI_PATH}`);

wss.on('connection', (ws) => {
  const history = [];

  ws.send(JSON.stringify({ role: 'system', text: `Connected to ${AGENT_NAME}` }));

  const hot = readWikiFile('hot.md');
  if (hot.trim()) {
    history.push({ role: 'user', content: `[session start — wiki context]\n${hot}` });
    history.push({ role: 'assistant', content: 'Got it. Ready.' });
  }

  ws.on('message', async (raw) => {
    let text;
    try { text = JSON.parse(raw).text; } catch { text = raw.toString(); }
    if (!text) return;

    history.push({ role: 'user', content: text });

    try {
      const reply = await runAgent({
        client,
        model: ANTHROPIC_MODEL,
        system: buildSystemPrompt(),
        tools,
        messages: history,
        onActivity: (msg) => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ role: 'system', text: msg }));
          }
        },
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
