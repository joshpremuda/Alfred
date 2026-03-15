const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.static(path.join(__dirname, 'public')));

const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.2';
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY || '';
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';
const AGENT_NAME = process.env.ALFRED_AGENT_NAME || 'Alfred';

const SYSTEM_PROMPT = `You are ${AGENT_NAME}, a helpful personal AI assistant. Be concise and friendly.`;

const BACKEND = ANTHROPIC_KEY ? 'anthropic' : 'ollama';
console.log(`[Alfred] Backend: ${BACKEND === 'anthropic' ? `Anthropic (${ANTHROPIC_MODEL})` : `Ollama (${OLLAMA_MODEL} @ ${OLLAMA_HOST})`}`);

async function chatOllama(history) {
  const res = await fetch(`${OLLAMA_HOST}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...history],
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
  const backend = BACKEND === 'anthropic'
    ? `Anthropic / ${ANTHROPIC_MODEL}`
    : `Ollama / ${OLLAMA_MODEL}`;

  ws.send(JSON.stringify({ role: 'system', text: `Connected to ${AGENT_NAME} (${backend})` }));

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
        ws.send(JSON.stringify({ role: 'agent', text: reply }));
      }
    } catch (err) {
      if (ws.readyState === WebSocket.OPEN) {
        const hint = BACKEND === 'ollama'
          ? `Could not reach Ollama at ${OLLAMA_HOST} — start it with: ollama serve`
          : `Anthropic API error: ${err.message}`;
        ws.send(JSON.stringify({ role: 'system', text: hint }));
      }
      history.pop(); // don't keep failed user message in history
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`[Alfred] Web chat at http://localhost:${PORT}`);
});
