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
const AGENT_NAME = process.env.ALFRED_AGENT_NAME || 'Alfred';

const SYSTEM_PROMPT = `You are ${AGENT_NAME}, a helpful personal AI assistant. Be concise and friendly.`;

// Per-connection conversation history
wss.on('connection', (ws) => {
  const history = [];

  ws.send(JSON.stringify({ role: 'system', text: `Connected to ${AGENT_NAME} (${OLLAMA_MODEL})` }));

  ws.on('message', async (raw) => {
    let text;
    try { text = JSON.parse(raw).text; } catch { text = raw.toString(); }
    if (!text) return;

    history.push({ role: 'user', content: text });

    try {
      const res = await fetch(`${OLLAMA_HOST}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: OLLAMA_MODEL,
          messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...history],
          stream: false,
        }),
      });

      if (!res.ok) {
        const err = await res.text();
        ws.send(JSON.stringify({ role: 'system', text: `Ollama error ${res.status}: ${err}` }));
        return;
      }

      const data = await res.json();
      const reply = data.message?.content || '(no response)';
      history.push({ role: 'assistant', content: reply });

      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ role: 'agent', text: reply }));
      }
    } catch (err) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ role: 'system', text: `Could not reach Ollama at ${OLLAMA_HOST} — is it running? (ollama serve)` }));
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`[Alfred] Web chat at http://localhost:${PORT}`);
  console.log(`[Alfred] Using ${OLLAMA_MODEL} via ${OLLAMA_HOST}`);
});
