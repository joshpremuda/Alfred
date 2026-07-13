# Changelog

All notable changes to Valet. Newest first.

## [Unreleased]

### Added
- **Hardening & polish (post-MVP).**
  - **Hybrid retrieval:** keyword search via SQLite **FTS5** (`chunks_fts` +
    triggers) merged with vector search, so the vault is searchable *immediately*
    — even before embeddings download or if a chunk failed to embed.
  - **`/api/reindex`** + a Vault "Reindex" button: rebuild the keyword index and
    backfill embeddings after the first-run model download.
  - **Obsidian import** (`/api/import/vault` + Vault "Import Obsidian" button):
    ingests Josh's existing vault notes on day one (strips frontmatter, skips
    Valet's own Inbox, dedupes). `ingestItem` gained `writeVaultNote` so imports
    don't duplicate source notes.
  - **`/api/search`** + a Vault search box (hybrid, item-level results).
  - **Markdown rendering** for chat replies and briefings (safe, node-based).
  - Seeded Josh's active projects (Smalley Coffee, Crema, Paper Filter, Digital
    Caddie Book, Clubsmanship).
  - Extracted pure vector math into `lib/vector.ts` and added a **Vitest suite**
    (`npm test`, 22 tests) covering cosine, BLOB round-trip, chunking, FTS query
    building, ICS parsing, and slugify.
  - Documented that **JARVIS and Valet are the same system**.
- **Phase 6 — Remote, autostart, polish.**
  - `scripts/install-launchd.sh`: runs Valet as a macOS login service (builds,
    starts at login, relaunches on crash; install/uninstall/status/logs).
  - `docs/SETUP.md`: complete setup guide — laptop prep, secrets, calendar,
    autostart, and Tailscale remote access for iPad/phone.
  - Voice input in chat (Web Speech API) and browser notifications.
  - This completes the Phase 1 MVP: Alfred is a working local-first second brain.
- **Phases 3–5 — Structure, Intelligence, Calendar.**
  - Projects (`lib/projects.ts`, `/api/projects`): status, notes, next action,
    and automatic stalled detection (14+ days inactive → status + notification).
  - Idea reservoir (`lib/ideas.ts`, `/api/ideas`): add/list, plus embedding-based
    idea↔item connection discovery that surfaces new links as notifications.
  - Notification center (`lib/notifications.ts`, `/api/notifications`): quiet by
    design, with a sidebar badge and optional browser notifications.
  - "Brief me" (`/api/brief`, `lib/context.ts`, `streamBriefing`): an on-demand,
    prioritized briefing over projects, calendar, captures, and open items.
  - Chat is now grounded in a compact state snapshot, so "what should I work on
    today?" / "what's stalled?" work in normal conversation.
  - Calendar awareness (`lib/calendar.ts`, `/api/calendar`): reads a published or
    exported `.ics` (`CALENDAR_ICS_URL` / `CALENDAR_ICS_FILE`) into state + briefings.
  - **UI shell:** sidebar navigation with Chat, Brief me, Vault, Projects, Ideas,
    and Notifications views; **voice input** (Web Speech API) in chat.
- **Phase 2 — Knowledge vault & retrieval (RAG).** Capture URLs, files, and
  notes; everything is chunked, embedded locally, and made searchable so Alfred
  answers from Josh's own knowledge.
  - `lib/embeddings.ts` (Transformers.js, `Xenova/all-MiniLM-L6-v2`, in-process),
    `lib/chunk.ts`, `lib/extract.ts` (Readability + `pdf-parse`), `lib/vault.ts`
    (Markdown notes with frontmatter into `<vault>/Valet/Inbox/`),
    `lib/ingest.ts` (hash-dedupe → optional Claude summary/classification →
    chunk → embed → write note), `lib/retrieval.ts` (cosine vector search).
  - API: `/api/capture` (URL), `/api/upload` (PDF/text), `/api/note`, `/api/items`.
  - `/api/chat` now retrieves relevant chunks and grounds Alfred's answers with
    `[n]` citations. Embeddings stored as Float32 BLOBs + in-process cosine
    (no native vector extension). Embedding failures are non-fatal — capture is
    never lost and can be re-embedded later.
  - UI: a capture bar (paste a URL or type a note) and a live "N in vault" count.
- Verified locally: `npm run build` passes; capture → chunk → vault-write →
  dedupe → items works over HTTP; Float32↔BLOB round-trip and cosine ranking
  validated against the real schema. (Live embedding runs on the Mac; the HF
  model download is blocked in this CI sandbox.)

### Changed
- **Dropped Ollama.** Local embeddings will run in-process via Transformers.js
  (`@huggingface/transformers`, `Xenova/all-MiniLM-L6-v2`) instead — free, private,
  and with no background daemon or separate install. Updated PRD, ARCHITECTURE,
  README, `.env.example`, and the setup script accordingly.
- `scripts/setup-macos.sh`: added an `uninstall-ollama` command (interactive,
  confirms each removal) and removed Ollama from prerequisite/readiness checks.

### Added
- **Phase 1 — Alfred MVP foundation.** Next.js (App Router, TypeScript) app at
  the repo root: streaming browser chat with the Alfred persona, three themes
  (Light / Dark / Sunny), and a Node API (`/api/chat`, `/api/history`).
- SQLite layer (`lib/db.ts`, `db/schema.sql`) via `better-sqlite3`: items,
  chunks, collections, projects, ideas, idea_links, notifications, messages,
  meta — with the collections and idea reservoir seeded. **Chat history now
  persists across restarts** (the prototype kept it only in RAM).
- `lib/claude.ts`: Anthropic streaming client with a cached system prompt.
- README rewritten as the Valet setup/run guide.
- Verified locally: `npm run build` passes, server boots, schema seeds, chat
  streams, messages persist, and the app degrades gracefully with no API key.
- Project governance docs: `PRD.md`, `ARCHITECTURE.md`, `TASKS.md`, `CHANGELOG.md`.

### Removed
- Superseded prototype: the Express/Ollama `webchat/` app, the `alfred` bash
  manager, and `config/agent.json` — replaced by the Next.js app.
- `scripts/setup-macos.sh` — Phase 0 laptop prep: report-only disk/clutter audit,
  interactive safe cache cleanup, prerequisite checks (Xcode CLT, Homebrew,
  Node 18+, Ollama), pulls the local `nomic-embed-text` embedding model, detects
  Obsidian vaults, and verifies the Anthropic key is present in `.env`.
- `.env.example` extended for Valet: Claude API as the answer backend, local
  Ollama embeddings, `BRAIN_VAULT` (Obsidian) path, and app port.

### Changed
- Reframed the project from the "Alfred/OpenClaw" prototype to **Valet** — a
  local-first AI OS whose Phase 1 deliverable is the Alfred agent. Target stack:
  Next.js + SQLite + Markdown (Obsidian) + Claude API, with local embeddings.

### Deprecated
- The Express/Ollama `webchat/` prototype and the `alfred` bash manager are
  superseded by the Next.js design in `ARCHITECTURE.md`; retained until the new
  chat route reaches parity, then removed.

### Security
- Valet now binds to **localhost (`127.0.0.1`) only** (dev, start, and the
  launchd service) — never `0.0.0.0` — so it is not exposed on the LAN or
  untrusted wifi. Remote access is via `tailscale serve` (tailnet-only, HTTPS).
- Upload route sanitizes client-supplied filenames (`path.basename` + allowlist)
  to prevent path traversal.
- Flagged that a live Anthropic API key was shared in plain text; it must be
  rotated. No key is stored in the repo; secrets live only in the gitignored
  `.env`.
