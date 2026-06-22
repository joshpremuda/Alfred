# Valet — Task Tracker

**Last Updated:** 2026-06-22

---

## Phase 1: Alfred MVP

### Documentation ✅
- [x] PRD.md
- [x] ARCHITECTURE.md
- [x] TASKS.md
- [x] CHANGELOG.md

### Foundation
- [x] Next.js 14 project scaffold
- [x] Tailwind CSS configuration
- [x] SQLite database setup (better-sqlite3)
- [x] Database schema initialization
- [x] Environment configuration (.env)
- [x] .gitignore updates

### Backend — Core
- [x] `lib/db.ts` — database connection and migrations
- [x] `lib/alfred.ts` — Alfred system prompt and Claude integration
- [x] `lib/search.ts` — FTS5 full-text search
- [x] `lib/ingest.ts` — file parsing (PDF, HTML, text)

### API Routes
- [x] POST /api/chat — streaming chat with Alfred
- [x] GET /api/brief — Brief Me generation
- [x] GET/POST /api/knowledge — knowledge vault CRUD
- [x] POST /api/knowledge/upload — file upload
- [x] GET /api/knowledge/search — search endpoint
- [x] GET/POST /api/projects — project management
- [x] PUT /api/projects/[id] — update project
- [x] GET/POST /api/ideas — idea reservoir
- [x] GET /api/collections — collections
- [x] GET/PUT /api/notifications — notification center

### Frontend — Layout
- [x] Root layout with sidebar navigation
- [x] Sidebar: chat, knowledge, projects, ideas, collections
- [x] Notification bell with count badge
- [x] Theme switcher (Light/Dark/Sunny)
- [x] Responsive layout

### Frontend — Chat
- [x] Chat interface component
- [x] Message history display
- [x] Streaming response rendering
- [x] "Brief Me" button
- [x] Markdown rendering in responses
- [x] Conversation persistence

### Frontend — Knowledge Vault
- [x] Knowledge vault page
- [x] File upload UI (drag & drop)
- [x] URL capture form
- [x] Search interface
- [x] Knowledge item list with preview

### Frontend — Projects
- [x] Projects list page
- [x] Project detail / edit
- [x] Status badges
- [x] Next actions list

### Frontend — Ideas
- [x] Idea reservoir page
- [x] Idea cards
- [x] Add idea form
- [x] Status filtering

### Frontend — Collections
- [x] Collections overview page
- [x] Collection detail with items

### Seed Data
- [x] Seed script with Josh's initial projects and ideas
- [x] Default collections

### Setup & Docs
- [x] Updated README with setup instructions
- [x] .env.example
- [x] launchd plist for macOS auto-start

---

## Phase 2: Integrations (Planned)

- [ ] Google Calendar API connection
- [ ] Instapaper import
- [ ] X (Twitter) bookmarks import
- [ ] Email ingestion (IMAP)
- [ ] Shopify integration for Smalley metrics
- [ ] Square integration
- [ ] n8n webhook endpoints
- [ ] Mobile notifications (PWA push)

## Phase 3: Additional Agents (Planned)

- [ ] Wayne — COO of Smalley Coffee
- [ ] Q — Systems Architect
- [ ] Creative — Design & Writing Director
- [ ] Multi-agent orchestration layer
