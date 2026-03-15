const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const OPENCLAW_WS = process.env.OPENCLAW_WS || 'ws://localhost:18789';

app.use(express.static(path.join(__dirname, 'public')));

// Proxy browser WebSocket connections to OpenClaw gateway
wss.on('connection', (browserWs) => {
  const agentWs = new WebSocket(OPENCLAW_WS);

  agentWs.on('open', () => {
    console.log('[Alfred] Connected to OpenClaw gateway');
  });

  agentWs.on('message', (data) => {
    if (browserWs.readyState === WebSocket.OPEN) {
      browserWs.send(data.toString());
    }
  });

  browserWs.on('message', (data) => {
    if (agentWs.readyState === WebSocket.OPEN) {
      agentWs.send(data.toString());
    }
  });

  const cleanup = () => {
    agentWs.close();
    browserWs.close();
  };

  browserWs.on('close', cleanup);
  agentWs.on('close', cleanup);
  agentWs.on('error', (err) => {
    console.error('[Alfred] Agent connection error:', err.message);
    cleanup();
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`[Alfred] Web chat available at http://localhost:${PORT}`);
});
