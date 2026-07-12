# Valet

A **local-first AI operating system** that runs on Josh's always-on MacBook —
his Chief of Staff, second brain, and command center. Not a chatbot.

**Phase 1 (this repo) builds one agent: Alfred** — a browser-based, persistent,
editorial assistant. See [`PRD.md`](./PRD.md), [`ARCHITECTURE.md`](./ARCHITECTURE.md),
and [`TASKS.md`](./TASKS.md) for the full plan.

## Stack

Next.js (App Router) · SQLite (`better-sqlite3`) · Markdown / Obsidian vault ·
Claude API for answers · local Ollama embeddings (free) for indexing.

## Setup (macOS)

**1. Prepare the laptop** — audit, clean, and check prerequisites:
```bash
./scripts/setup-macos.sh          # read-only report + readiness
./scripts/setup-macos.sh clean    # optional interactive cleanup
./scripts/setup-macos.sh vault    # point Alfred at your Obsidian vault
./scripts/setup-macos.sh doctor   # confirm "ready for Valet"
```
This checks Node 18+, Ollama, pulls `nomic-embed-text`, and writes `BRAIN_VAULT`.

**2. Configure secrets:**
```bash
cp .env.example .env
# then edit .env and add your (rotated) ANTHROPIC_API_KEY
```
> ⚠️ Never paste your API key into a chat. It lives only in `.env` (gitignored).

**3. Install and run:**
```bash
npm install
npm run dev        # http://localhost:3210   (use `npm run build && npm run start` for production)
```

## Remote access (iPad / phone)

Install [Tailscale](https://tailscale.com) on the Mac and your devices, then open
`http://<mac-magicdns-name>:3210` from anywhere on your tailnet. Valet is never
exposed to the public internet.

## Project layout

```
app/        Next.js UI + API routes (/api/chat, /api/history)
lib/        db.ts (SQLite), claude.ts (Anthropic client)
db/         schema.sql
scripts/    setup-macos.sh (Phase 0 laptop prep)
PRD.md ARCHITECTURE.md TASKS.md CHANGELOG.md
```

## What works today (Phase 1)

- Browser chat with Alfred, streaming replies, three themes (Light / Dark / Sunny)
- **Persistent** history in SQLite (survives restarts)
- Seeded collections and the idea reservoir
- Local-only data; graceful behavior when the API key isn't set

Next up: knowledge vault + retrieval (Phase 2), collections/projects/notifications
(Phase 3), and the "Brief me" command (Phase 4). See [`TASKS.md`](./TASKS.md).
