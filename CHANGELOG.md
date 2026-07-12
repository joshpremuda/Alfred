# Changelog

All notable changes to Valet. Newest first.

## [Unreleased]

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
- Flagged that a live Anthropic API key was shared in plain text; it must be
  rotated. No key is stored in the repo; secrets live only in the gitignored
  `.env`.
