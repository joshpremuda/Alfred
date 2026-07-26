# Valet — Product Requirements Document

> Owner: Josh Premuda · Status: **Draft, Phase 1 in progress** · Last updated: 2026-07-12

## 1. What Valet is

Valet is a **local-first AI operating system** that runs on Josh's always-on
MacBook. It is not a chatbot. It is a personal **Chief of Staff, second brain,
and command center**.

> **Naming:** *JARVIS* and *Valet* refer to the same system — JARVIS = "Josh's
> Artificial Valet Intelligence System"; **Valet** is the project/product name
> used throughout this repo.

Valet understands Josh's projects, schedule, ideas, reading, priorities, and
businesses, and surfaces the *right* information at the right time rather than
dumping everything.

**Phase 1 builds only one agent: Alfred.** Future agents (Wayne, Q, Creative,
Buffett, 007) are documented but not built.

## 2. Principles

Optimize for: **simplicity, reliability, low cost, local operation, minimal
maintenance.**

Avoid: overengineering, microservices, enterprise infra, complex agent
frameworks, excessive dependencies.

Prefer: **SQLite, local files, Markdown, a single deployable app.**

Design language: **minimal, editorial, clean, calm, intelligent.** Themes:
**Light / Dark / Sunny.**

## 3. Alfred (Phase 1)

Alfred is Josh's Chief of Staff. Personality: **calm, intelligent, organized,
editorial, minimal, helpful without being annoying.** Alfred **prioritizes**
information and **makes recommendations** — he does not just answer.

### MVP features

| # | Feature | Description |
|---|---------|-------------|
| F1 | **Chat interface** | Browser-based chat. The primary interface. Voice is a fast-follow. |
| F2 | **Knowledge vault** | Upload PDFs, docs, notes, articles, links. Everything becomes searchable. Backed by Josh's **Obsidian** markdown vault. |
| F3 | **URL capture** | Save URLs (articles, tweets, inspiration, research) into the knowledge system. |
| F4 | **Collections** | Auto-organize items into Projects, Ideas, Reading, Inspiration, Resources, Smalley Coffee. Items may belong to multiple collections. |
| F5 | **Idea reservoir** | A permanent, never-deleted repository of ideas. Alfred periodically connects ideas to new information. |
| F6 | **Project tracking** | Projects have status, notes, next actions, related resources. Alfred knows what is active vs. stalled. |
| F7 | **Calendar awareness** | Understand upcoming meetings, free time, conflicts, deadlines (macOS Calendar). |
| F8 | **"Brief me"** | On-demand briefing: key calendar items, open priorities, project updates, relevant saved content, opportunities. Concise and actionable. No scheduled emails required initially. |
| F9 | **Notification center** | Valet stays quiet. Instead of pinging, it maintains a center: "Alfred has 3 items worth your attention." |

### Commands Alfred must answer

- What should I work on today?
- What changed since yesterday?
- What projects are stalled?
- What opportunities am I missing?
- Brief me.
- Summarize everything I know about `<topic>`.
- Build a plan for `<idea>`.
- Draft this in my voice.

## 4. Idea reservoir (seed)

Never deleted, always resurfaceable:

Digital Caddie Book · Clubsmanship · Crema · The Paper Filter ·
Grounds for Living · Smalley Website Refresh · Notes From Your Father ·
Coloring Graffiti · Sandwich.Services · Church Project · Soccer Club ·
Cupping Guide · A Man and His Espresso.

## 5. User profile

- **Owner:** Josh Premuda
- **Active projects:** Smalley Coffee, Crema, Paper Filter, Digital Caddie Book, Clubsmanship
- **Goals:** recurring income · grow Smalley Coffee · create media properties · build AI-leveraged systems
- **Taste references:** Monocle, Arc Browser, Linear, Cabinet
- **Devices:** always-on MacBook (host) · iPad + phone (remote clients)

## 6. Knowledge sources (design for, don't build all now)

Instapaper · X bookmarks/likes · Pinterest · Instagram saves · Feedly ·
Email · Shopify · Square · Apple Notes · iMessage · Contacts.

Phase 1 builds: **manual URL capture + file upload.** The ingestion pipeline is
built so importers can be added later without schema changes.

## 7. Constraints & non-goals

- **Cost discipline.** Answers use the Claude API; **embeddings run locally
  in-process** (Transformers.js, free — no Ollama, no daemon) so indexing never
  spends tokens. Retrieval sends only the most relevant chunks to Claude. This
  keeps token usage low and "clean."
- **Data hygiene.** The vault stays clean and de-duplicated so retrieval is high
  signal — "clean data to keep the token level clean."
- **Quiet by default.** No notification spam.
- **Local-first.** Runs primarily from the MacBook; remote devices reach it over
  Tailscale. No cloud database.
- **Not** a multi-agent framework (yet). Not enterprise infra. Not microservices.

## 8. Success criteria for the MVP

Josh can, from his laptop (and iPad over Tailscale):
1. Chat with Alfred in the browser.
2. Drop in a URL or file and have it captured, categorized, and searchable.
3. Ask "Brief me" and get a concise, useful briefing drawn from his calendar,
   projects, and saved content.
4. See a notification center instead of receiving pings.
5. Trust that ideas and projects persist across restarts.

## 9. Future agents (documented, not built)

- **Wayne** — COO of Smalley Coffee (Shopify, email, Square, inventory, social).
- **Q** — systems architect (builds plans, trading app, keeps the Mac organized).
- **Creative** — design & writing director (learns Josh's voice, produces copy/design).
- **Buffett** — financial agent.
- **007** — competitor & intel research.

See `ARCHITECTURE.md` §"Future agents" for how the single-app design extends to them.
