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

## Phase 3 — Structure  `[ ]`

- [ ] Collections (Projects, Ideas, Reading, Inspiration, Resources, Smalley Coffee)
- [ ] Auto-classification of new items into collections (Claude)
- [ ] Project tracking (status, notes, next action, stalled detection)
- [ ] Idea reservoir seeded from PRD §4; never hard-deleted
- [ ] Notification center (quiet; "Alfred has N items worth your attention")

## Phase 4 — Intelligence  `[ ]`

- [ ] "Brief me" routine (calendar + priorities + projects + saved content + opportunities)
- [ ] "What should I work on today?" / "What changed since yesterday?"
- [ ] "What projects are stalled?" (activity-based)
- [ ] Idea ↔ item connection discovery (periodic) → notifications
- [ ] "Build a plan for `<idea>`" and "Draft this in my voice"

## Phase 5 — Calendar awareness  `[ ]`

- [ ] macOS Calendar bridge (ICS export / EventKit helper), read-only
- [ ] Merge project deadlines into the calendar view
- [ ] Conflict + free-time detection feeding "Brief me"

## Phase 6 — Remote, autostart, polish  `[ ]`

- [ ] Tailscale setup guide; bind to Tailscale + localhost only (never public `0.0.0.0`)
- [ ] launchd LaunchAgent generator (start at login, relaunch on crash)
- [ ] Voice interface for chat (fast-follow)
- [ ] Setup guide + local installation instructions (Deliverables)

## Future — additional agents (documented, not built)  `[>]`

- [>] Wayne (Smalley COO) · Q (systems) · Creative (writing/design) · Buffett (finance) · 007 (intel)
- [>] Source importers: Instapaper, X bookmarks/likes, Pinterest, Instagram, Feedly, email, Shopify, Square, Apple Notes, iMessage, Contacts

## Open items for Josh

- Rotate the Anthropic API key that was shared in chat; put the new one in `.env`.
- Confirm the Obsidian vault path once `setup-macos.sh` reports candidates.
- Confirm target port (default **3210**) if you want something else.
