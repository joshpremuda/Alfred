const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const { spawn } = require('child_process');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.static(path.join(__dirname, 'public')));

wss.on('connection', (ws) => {
  ws.send(JSON.stringify({ role: 'system', text: 'Connected. Say hello!' }));

  ws.on('message', (raw) => {
    let text;
    try { text = JSON.parse(raw).text; } catch { text = raw.toString(); }
    if (!text) return;

    const child = spawn('openclaw', ['send', text], {
      env: { ...process.env },
    });

    let reply = '';
    child.stdout.on('data', (d) => { reply += d.toString(); });
    child.stderr.on('data', (d) => { console.error('[openclaw]', d.toString().trim()); });

    child.on('close', (code) => {
      if (ws.readyState !== WebSocket.OPEN) return;
      if (reply.trim()) {
        ws.send(JSON.stringify({ role: 'agent', text: reply.trim() }));
      } else {
        ws.send(JSON.stringify({ role: 'system', text: `(openclaw exited ${code} with no output)` }));
      }
    });

    child.on('error', (err) => {
      if (ws.readyState !== WebSocket.OPEN) return;
      ws.send(JSON.stringify({ role: 'system', text: `Error: ${err.message}` }));
    });
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`[Alfred] Web chat at http://localhost:${PORT}`);
});
