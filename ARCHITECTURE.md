# Valet — Architecture

> Last updated: 2026-07-12 · Companion to `PRD.md` and `TASKS.md`

## 1. One app, on one machine

Valet is a **single Next.js application** running on Josh's always-on MacBook.
No microservices, no external database, no cloud infra. The App Router serves
both the UI (React) and the backend (API routes / server actions). This is the
"single application deployment" the PRD calls for.

```
┌──────────────────────── MacBook (always on) ────────────────────────┐
│                                                                       │
│   Next.js app  (npm run start, port 3210, managed by launchd)         │
│   ├── UI            React, App Router, Light/Dark/Sunny themes         │
│   ├── API routes    /api/chat  /api/capture  /api/brief  /api/...      │
│   ├── Claude client Anthropic SDK  (answers, briefings, drafting)      │
│   └── Retrieval     local embeddings + SQLite vector search           │
│                                                                       │
│   SQLite  (data/valet.db)         structured data + vectors           │
│   Obsidian vault  (markdown)      the human-readable knowledge store   │
│   Ollama  (nomic-embed-text)      local, free embeddings              │
│                                                                       │
└───────────────────────────────────────────────────────────────────────┘
         ▲                                   ▲
         │ Tailscale (MagicDNS)              │ browser
     iPad / phone                        Mac browser
```

## 2. Technology choices

| Concern | Choice | Why |
|---------|--------|-----|
| App framework | **Next.js (App Router)** | Single deployable app: UI + API in one process. Josh's stated preference. |
| Language | **TypeScript / Node** | One language across UI and server. |
| Structured data | **SQLite** via `better-sqlite3` | Zero-ops, file-based, fast, reliable. Synchronous API keeps code simple. |
| Vector search | **SQLite + `sqlite-vec`** | Keeps vectors next to the data. No separate vector DB. |
| Knowledge store | **Markdown in the Obsidian vault** | Human-editable, portable, already Josh's habit. Alfred reads/writes here. |
| Answers / reasoning | **Claude API** (`@anthropic-ai/sdk`) | Best quality; billed per-token (separate from Claude Pro limits). |
| Embeddings | **Ollama `nomic-embed-text`** (local) | Free, private, unlimited — indexing never spends Claude tokens. |
| Remote access | **Tailscale** | The Mac joins the tailnet; iPad/phone reach it by MagicDNS. No ports opened to the internet. |
| Autostart | **launchd** (macOS) | Keeps Valet running on the always-on Mac; restarts on crash/login. |
| Notifications | Browser + email (future mobile) | Quiet notification center is the primary surface. |

### Why local embeddings + cloud answers (the cost model)

The PRD demands low, "clean" token usage. The split:

- **Indexing / retrieval → local.** Every uploaded doc, URL, and note is chunked
  and embedded with Ollama on-device. This is free and unlimited, so building and
  re-building the index costs nothing.
- **Answering → Claude.** Only the top-k relevant chunks (retrieved locally) plus
  a compact profile are sent to Claude. Prompt caching covers the stable system
  prompt / profile. Net effect: Claude sees a small, high-signal context per
  request, so token spend stays low and predictable.

## 3. Data model (SQLite)

Tables (initial cut — see migrations in `db/`):

- `items` — every captured thing (url | file | note). Columns: id, type, title,
  url, source, file_path, text_summary, created_at, ingested_at.
- `chunks` — text chunks per item for retrieval: id, item_id, ord, content.
- `chunk_vectors` — `sqlite-vec` virtual table: chunk_id ↔ embedding.
- `collections` — Projects, Ideas, Reading, Inspiration, Resources, Smalley Coffee.
- `item_collections` — many-to-many (an item can be in several collections).
- `projects` — id, name, status (active|stalled|done|someday), notes, next_action,
  last_activity_at.
- `ideas` — the reservoir. Never hard-deleted (soft archive only).
- `idea_links` — discovered connections between an idea and an item.
- `notifications` — id, kind, title, body, importance, created_at, read_at.
- `messages` — chat history (persisted, unlike the current prototype).
- `meta` — key/value: schema version, last-import cursors per source.

## 4. Knowledge vault ↔ Obsidian

- Josh's Obsidian vault path is configured via `BRAIN_VAULT` in `.env`.
- Captured notes and item summaries are written as Markdown files in the vault
  (e.g. `Valet/Inbox/<slug>.md`) with YAML frontmatter (collections, source,
  created). Obsidian and Alfred stay in sync through plain files.
- Uploaded binaries (PDFs, images) are copied into `data/documents/`; extracted
  text lives in `items`/`chunks`. The vault holds the readable summary + link.
- **Source of truth:** SQLite for structure and vectors; Markdown for human-
  readable content. The vault can always be reindexed from scratch.

## 5. Ingestion pipeline (built once, reused by every source)

```
capture(url | file | note)
  → extract text        (readability for URLs, pdf-parse for PDFs, passthrough for notes)
  → normalize + dedupe  (hash; skip if already ingested — keeps data clean)
  → summarize (Claude, cheap) + auto-classify into collections
  → chunk               (~500–800 tokens, overlap)
  → embed (Ollama)      → store vectors
  → write markdown note into the Obsidian vault
```

Future importers (Instapaper, X bookmarks, Pinterest, Feedly, email, Shopify,
Square, Apple Notes/iMessage) are just new **front doors** that produce `items`
and call the same pipeline. They store a per-source cursor in `meta` so imports
are incremental. **No schema changes needed to add a source.**

## 6. Retrieval & "Brief me"

- **Ask / search:** embed the query locally → vector search over `chunks` →
  optional keyword fallback → assemble top-k context → Claude answers with
  citations back to items.
- **Brief me:** a server routine that gathers (a) today/tomorrow calendar,
  (b) active + newly-stalled projects, (c) recent captures relevant to active
  work, (d) fresh idea↔item connections, then asks Claude to produce a short,
  prioritized briefing. Output is rendered in the UI and can post items into the
  notification center.

## 7. Calendar awareness (macOS)

Phase 1 reads calendar via an **ICS export / EventKit bridge** (a small local
helper the Mac can run), exposed to the app as read-only events. No cloud
calendar credentials required initially. Deadlines from `projects` are merged in.

## 8. Remote access & autostart

- **Tailscale:** install on the Mac and on iPad/phone; access Valet at
  `http://<mac-magicdns-name>:3210`. Bound to the Tailscale + localhost
  interfaces only — never `0.0.0.0` on the public network.
- **launchd:** a `LaunchAgent` plist starts Valet at login and relaunches on
  crash. Generated by the Phase 6 setup step.

## 9. Themes & design

Light / Dark / **Sunny**. Editorial, minimal, calm — Monocle/Linear/Cabinet
references. Theme is a CSS-variable set toggled at the root; all three shipped
from the start so the aesthetic is locked early.

## 10. Repository layout (target)

```
/                     Next.js app root
  app/                UI + API routes
  lib/                claude.ts, embeddings.ts, retrieval.ts, ingest.ts
  db/                 schema.sql, migrations, better-sqlite3 setup
  data/               valet.db, documents/   (gitignored)
  scripts/            setup-macos.sh, launchd plist generator, importers
  PRD.md ARCHITECTURE.md TASKS.md CHANGELOG.md
```

The existing Express/Ollama app under `webchat/` is a **prototype** and will be
retired once the Next.js chat route works. `alfred` (bash) and `config/agent.json`
are superseded by this design.

## 11. Future agents (how the single app extends)

Agents are **not** separate services. Each is a **persona + toolset + system
prompt** selectable in the same app, sharing one SQLite DB and vault:

- **Wayne** — Smalley ops; tools: Shopify/Square/email connectors.
- **Q** — systems/architecture; tools: filesystem, planning.
- **Creative** — voice-trained writing/design; corpus = Josh's past writing.
- **Buffett** — finance; tools: market data, spreadsheets.
- **007** — competitor/intel research; tools: web.

Adding an agent = a row in a `agents` config + its tool bindings. No new
infrastructure. This is why Phase 1 stays a single app.
