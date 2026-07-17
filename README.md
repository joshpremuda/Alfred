# Valet

A **local-first AI operating system** that runs on Josh's always-on MacBook —
his Chief of Staff, second brain, and command center. Not a chatbot.

> *JARVIS* and *Valet* are the same system (JARVIS = "Josh's Artificial Valet
> Intelligence System"; Valet is the project name).

**Phase 1 (this repo) builds one agent: Alfred** — a browser-based, persistent,
editorial assistant. See [`PRD.md`](./PRD.md), [`ARCHITECTURE.md`](./ARCHITECTURE.md),
and [`TASKS.md`](./TASKS.md) for the full plan.

## Stack

Next.js (App Router) · SQLite (`better-sqlite3`) · Markdown / Obsidian vault ·
Claude API for answers · local in-process embeddings (Transformers.js, free) for
indexing — no Ollama, no background daemon.

## Setup

**Fastest path — two commands** (prereq: Node 18+). Bootstrap handles config,
vault detection, the key prompt, install, build, test, and start:

```bash
git clone -b claude/laptop-second-brain-setup-7jiuw7 https://github.com/joshpremuda/Alfred.git valet && cd valet
./scripts/bootstrap-macos.sh
```
It asks you to paste your `ANTHROPIC_API_KEY` once (hidden input → saved to the
gitignored `.env`), then opens **http://localhost:3210**. In the browser: Vault →
**Import Obsidian**, then **Reindex** after the first message.

Full step-by-step (calendar, autostart, iPad/phone remote) is in
**[`docs/SETUP.md`](./docs/SETUP.md)**.
> ⚠️ Never paste your API key into a chat. It lives only in `.env` (gitignored).

**Always-on:** `./scripts/install-launchd.sh install` runs Valet as a login
service. **Remote:** Valet binds to localhost only; expose it to your iPad/phone
tailnet-only with [Tailscale](https://tailscale.com) via `tailscale serve --bg 3210`
(see [`docs/SETUP.md`](./docs/SETUP.md) §6).

## Project layout

```
app/            UI shell + views + API routes (chat, capture, brief, projects…)
app/components/ Sidebar + Chat/Brief/Vault/Projects/Ideas/Notifications views
lib/            db, claude, embeddings, ingest, retrieval, projects, ideas,
                notifications, calendar, context
db/             schema.sql
scripts/        setup-macos.sh (Phase 0), install-launchd.sh (autostart)
docs/SETUP.md · PRD.md · ARCHITECTURE.md · TASKS.md · CHANGELOG.md
```

## What works today (MVP complete)

- **Chat** with Alfred — streaming, voice input, grounded in your knowledge + a
  live snapshot of your projects/calendar ("what should I work on today?").
- **Knowledge vault** — capture URLs/files/notes → summarized, auto-filed into
  Collections, embedded locally, written to your Obsidian vault, and searchable.
- **Brief me** — an on-demand, prioritized briefing.
- **Projects** — status, next actions, automatic stalled detection.
- **Idea reservoir** — seeded from your list; Alfred links new material to ideas.
- **Notification center** — quiet by design, with a sidebar badge.
- **Calendar awareness** — via a published/exported `.ics`.
- Three themes (Light / Dark / **Sunny**); persistent SQLite; graceful with no key.

Future agents (Wayne, Q, Creative, Buffett, 007) and source importers
(Instapaper, X, Pinterest, Shopify…) are designed for but not built — see
[`TASKS.md`](./TASKS.md) and [`ARCHITECTURE.md`](./ARCHITECTURE.md).
