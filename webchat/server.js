const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.static(path.join(__dirname, 'public')));

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || '';
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';
const AGENT_NAME = process.env.ALFRED_AGENT_NAME || 'Alfred';

if (!ANTHROPIC_KEY) {
  console.error('[Alfred] ANTHROPIC_API_KEY is not set — edit .env and restart');
  process.exit(1);
}

const client = new Anthropic({ apiKey: ANTHROPIC_KEY });

const SYSTEM_PROMPT = `You are ${AGENT_NAME}, a helpful personal AI assistant. Be concise and friendly.`;

console.log(`[Alfred] Model: ${ANTHROPIC_MODEL}`);

async function chat(history) {
  const msg = await client.messages.create({
    model: ANTHROPIC_MODEL,
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: history,
  });
  return msg.content[0]?.text || '(no response)';
}

wss.on('connection', (ws) => {
  const history = [];

  ws.send(JSON.stringify({ role: 'system', text: `Connected to ${AGENT_NAME}` }));

  ws.on('message', async (raw) => {
    let text;
    try { text = JSON.parse(raw).text; } catch { text = raw.toString(); }
    if (!text) return;

    history.push({ role: 'user', content: text });

    try {
      const reply = await chat(history);
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
