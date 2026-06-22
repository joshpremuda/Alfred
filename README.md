# Valet — Alfred

Your personal Chief of Staff. A local-first AI operating system built on Next.js + SQLite + Claude.

---

## What is Alfred?

Alfred is your second brain and executive assistant. He knows your projects, tracks your ideas, stores your knowledge, and helps you understand what matters right now.

Ask Alfred:
- *"What should I work on today?"*
- *"Brief me."*
- *"What projects are stalled?"*
- *"What do I know about specialty coffee media?"*
- *"Save this for later."*

---

## Setup

### 1. Prerequisites

- Node.js 18+
- An Anthropic API key — [get one here](https://console.anthropic.com/keys)

### 2. Install

```bash
git clone <this-repo>
cd Alfred
npm install
```

### 3. Configure

```bash
cp .env.example .env.local
```

Edit `.env.local` and add your Anthropic API key:

```
ANTHROPIC_API_KEY=sk-ant-...
```

### 4. Seed initial data

```bash
node scripts/seed.js
```

This creates your projects, ideas, and collections from the initial setup.

### 5. Start

```bash
npm run dev       # Development (hot reload)
# or
npm run build && npm start   # Production
```

Open [http://localhost:3000](http://localhost:3000)

---

## Auto-start on macOS

To have Valet start automatically when you log in:

1. Edit `com.valet.alfred.plist` — replace `/path/to/Alfred` with your actual path
2. Copy to launchd:

```bash
cp com.valet.alfred.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/com.valet.alfred.plist
```

Logs at `/tmp/valet.log`

---

## Remote Access via Tailscale

1. Install [Tailscale](https://tailscale.com)
2. Start Valet on your MacBook
3. Access from any device on your Tailnet at `http://your-mac-hostname:3000`

---

## Features

| Feature | Description |
|---------|-------------|
| **Chat** | Natural language interface with Alfred |
| **Brief Me** | On-demand executive briefing |
| **Knowledge Vault** | Save URLs, upload PDFs, search everything |
| **Projects** | Track status and next actions |
| **Ideas** | Permanent idea reservoir |
| **Collections** | Organized knowledge by topic |
| **Notifications** | Quiet notification center |
| **Themes** | Light, Dark, Sunny |

---

## Future Agents

| Agent | Role | Status |
|-------|------|--------|
| Wayne | COO of Smalley Coffee | Planned |
| Q | Systems Architect | Planned |
| Creative | Design & Writing Director | Planned |

---

## Project Structure

```
src/
  app/
    chat/          # Primary interface
    knowledge/     # Knowledge vault
    projects/      # Project tracker
    ideas/         # Idea reservoir
    collections/   # Collections
    api/           # All API routes
  components/      # Shared UI components
  lib/
    alfred.ts      # Alfred AI + Claude integration
    db.ts          # SQLite database
    ingest.ts      # File/URL content extraction
data/              # SQLite database (gitignored)
uploads/           # Uploaded files (gitignored)
scripts/           # Seed and utility scripts
```

---

## Troubleshooting

**Alfred can't connect to Claude**
- Check `ANTHROPIC_API_KEY` is set in `.env.local`
- Verify your key at console.anthropic.com

**Database errors on first run**
- Run `node scripts/seed.js` first
- The `data/` directory must be writable

**Port already in use**
- Set `PORT=3001` in `.env.local`
