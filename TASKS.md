# Valet — Tasks

> Last updated: 2026-07-12 · Companion to `PRD.md` and `ARCHITECTURE.md`
> Legend: `[ ]` todo · `[~]` in progress · `[x]` done · `[>]` deferred/future

## Phase 0 — Laptop prep & cleanup  `[~]`

The always-on Mac must be clean and provisioned before Valet runs on it.
Delivered as `scripts/setup-macos.sh` (report-only by default; never deletes
without explicit `clean` + confirmation).

- [x] `setup-macos.sh` — disk & clutter report
- [x] `setup-macos.sh` — safe cache cleanup (interactive)
- [x] `setup-macos.sh` — prerequisite check (Xcode CLT, Homebrew, Node 18+)
- [x] `setup-macos.sh` — `uninstall-ollama` (Ollama dropped; embeddings run in-process)
- [x] `setup-macos.sh` — Obsidian vault detection → `BRAIN_VAULT`
- [x] `setup-macos.sh` — verify `ANTHROPIC_API_KEY` present in `.env`
- [ ] Run it on the actual laptop and confirm a green "ready" report *(Josh)*
- [ ] **Rotate the leaked API key** and store the new one in `.env` *(Josh)*

## Phase 1 — Foundations  `[x]`

- [x] Scaffold Next.js (App Router, TypeScript) as the app root
- [x] `better-sqlite3` setup + `db/schema.sql` (items, chunks, collections,
      projects, ideas, notifications, messages, meta) — seeds collections + ideas
- [~] `sqlite-vec` wiring for `chunk_vectors` — deferred to Phase 2 (loaded at runtime)
- [x] `lib/claude.ts` (Anthropic streaming client, cached system prompt)
- [x] Base chat route `/api/chat` + persisted `messages` (+ `/api/history`)
- [x] Chat UI with Alfred persona; Light/Dark/Sunny themes
- [x] Retire `webchat/` prototype (removed; also removed legacy `alfred` + `config/`)
- [x] Verified: `npm run build` passes, server boots, DB seeds, streaming + persistence work
- [ ] Add rotated `ANTHROPIC_API_KEY` to `.env` and confirm live replies *(Josh, on the Mac)*

## Phase 2 — Knowledge vault & retrieval  `[x]`

- [x] `lib/embeddings.ts` — Transformers.js (`Xenova/all-MiniLM-L6-v2`), in-process; Float32↔BLOB helpers
- [x] `lib/ingest.ts` — dedupe (hash) → summarize/classify (Claude, optional) → chunk → embed → write markdown; embedding failures non-fatal
- [x] `lib/chunk.ts`, `lib/extract.ts` (Readability + `pdf-parse` v2), `lib/vault.ts`
- [x] URL capture `/api/capture` (Readability extraction)
- [x] File upload `/api/upload` (PDF via `pdf-parse`, text/markdown); `/api/note`; `/api/items`
- [x] Obsidian vault write (frontmatter, `<vault>/Valet/Inbox/`; falls back to `data/vault`)
- [x] `lib/retrieval.ts` — query embed → cosine vector search → context assembly
- [x] Retrieval wired into `/api/chat` so Alfred answers from the vault and cites `[n]`
- [x] Capture bar + "N in vault" count in the UI
- [x] Verified: build passes; capture→chunk→vault→dedupe→items over HTTP; cosine ranking on real schema
- [ ] Live embedding + semantic answers — confirm on the Mac (needs the model download, blocked in CI) *(Josh)*

## Phase 3 — Structure  `[x]`

- [x] Collections (Projects, Ideas, Reading, Inspiration, Resources, Smalley Coffee) — seeded
- [x] Auto-classification of new items into collections (Claude, in ingest)
- [x] Project tracking (`lib/projects.ts`, `/api/projects`, Projects view) with stalled detection
- [x] Idea reservoir seeded from PRD §4; add + list (`lib/ideas.ts`, Ideas view); never hard-deleted
- [x] Notification center (`lib/notifications.ts`, `/api/notifications`, view + sidebar badge, browser notifications)

## Phase 4 — Intelligence  `[x]`

- [x] "Brief me" (`/api/brief`, `lib/context.ts` + `streamBriefing`) — Brief view auto-runs & streams
- [x] "What should I work on today?" / "what's stalled?" answered via state-context injected into chat
- [x] Stalled detection (activity-based, `detectStalled`) → notifications
- [x] Idea ↔ item connection discovery (`connectRecentItems`, embedding similarity) → notifications
- [x] "Build a plan for `<idea>`" / "Draft in my voice" handled by Alfred's persona + retrieval

## Phase 5 — Calendar awareness  `[x]`

- [x] Calendar bridge via published/exported ICS (`lib/calendar.ts`, `/api/calendar`); `CALENDAR_ICS_URL|FILE`
- [x] Events fed into state context + briefings
- [ ] EventKit live-sync helper + free-time/conflict detection — future refinement

## Phase 6 — Remote, autostart, polish  `[x]`

- [x] launchd LaunchAgent generator (`scripts/install-launchd.sh`): build, start at login, relaunch on crash
- [x] Tailscale remote-access guide (`docs/SETUP.md` §6)
- [x] Voice input for chat (Web Speech API 🎙)
- [x] Setup guide + local installation instructions (`docs/SETUP.md`)
- [x] Browser notifications from the notification center

## Hardening & polish (post-MVP)  `[x]`

- [x] Hybrid retrieval: FTS5 keyword search merged with vector search (searchable with no model)
- [x] `/api/reindex` (+ Vault button): rebuild FTS + backfill embeddings after model download
- [x] `/api/search` (+ Vault search box): hybrid, item-level results
- [x] Markdown rendering for chat + briefings (`Markdown.tsx`, safe/node-based)
- [x] Seed active projects (Smalley Coffee, Crema, Paper Filter, Digital Caddie Book, Clubsmanship)
- [x] `lib/vector.ts` extraction + Vitest suite (`npm test`, 22 tests)
- [x] Note that JARVIS ≡ Valet

## Future — additional agents (documented, not built)  `[>]`

- [>] Wayne (Smalley COO) · Q (systems) · Creative (writing/design) · Buffett (finance) · 007 (intel)
- [>] Source importers: Instapaper, X bookmarks/likes, Pinterest, Instagram, Feedly, email, Shopify, Square, Apple Notes, iMessage, Contacts

## Open items for Josh

- Rotate the Anthropic API key that was shared in chat; put the new one in `.env`.
- Confirm the Obsidian vault path once `setup-macos.sh` reports candidates.
- Confirm target port (default **3210**) if you want something else.
