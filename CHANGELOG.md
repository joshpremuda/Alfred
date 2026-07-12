# Changelog

All notable changes to Valet. Newest first.

## [Unreleased]

### Added
- Project governance docs: `PRD.md`, `ARCHITECTURE.md`, `TASKS.md`, `CHANGELOG.md`.
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
