# Valet — Architecture Document

**Version:** 1.0  
**Date:** 2026-06-22

---

## System Overview

Valet is a single Next.js application running locally on a MacBook. It combines a web frontend, API layer, SQLite database, and local file storage into one deployable unit.

```
┌─────────────────────────────────────────────────────────┐
│                    Browser (localhost:3000)              │
│   Chat │ Knowledge │ Projects │ Ideas │ Collections     │
└──────────────────────┬──────────────────────────────────┘
                       │ HTTP / WebSocket
┌──────────────────────▼──────────────────────────────────┐
│              Next.js App (App Router)                   │
│   ┌──────────────┐  ┌──────────────┐  ┌─────────────┐  │
│   │  API Routes  │  │    Pages     │  │  Components │  │
│   └──────┬───────┘  └──────────────┘  └─────────────┘  │
│          │                                              │
│   ┌──────▼───────────────────────────────────────────┐ │
│   │                  lib/                            │ │
│   │   alfred.ts   db.ts   search.ts   ingest.ts     │ │
│   └──────┬────────────────┬────────────────┬─────────┘ │
└──────────┼────────────────┼────────────────┼───────────┘
           │                │                │
    ┌──────▼──────┐  ┌──────▼──────┐  ┌─────▼──────┐
    │ Claude API  │  │   SQLite    │  │Local Files │
    │ (Anthropic) │  │  valet.db   │  │ /uploads   │
    └─────────────┘  └─────────────┘  └────────────┘
```

---

## Technology Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Frontend | Next.js 14 (App Router) | Full-stack, SSR, file-based routing |
| Styling | Tailwind CSS | Utility-first, fast iteration |
| Backend | Next.js API Routes | No separate server process |
| Database | SQLite (better-sqlite3) | Local, zero-config, fast, reliable |
| AI | Anthropic Claude API | Best reasoning, tool use support |
| File Storage | Local filesystem | Simple, no cloud dependency |
| Text Search | SQLite FTS5 | Built-in, no Elasticsearch needed |
| File Parsing | pdf-parse, cheerio | PDF and HTML content extraction |

---

## Database Schema

### conversations
```sql
CREATE TABLE conversations (
  id TEXT PRIMARY KEY,
  title TEXT,
  created_at INTEGER,
  updated_at INTEGER
);
```

### messages
```sql
CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT,
  role TEXT,  -- 'user' | 'assistant' | 'system'
  content TEXT,
  created_at INTEGER,
  FOREIGN KEY (conversation_id) REFERENCES conversations(id)
);
```

### knowledge_items
```sql
CREATE TABLE knowledge_items (
  id TEXT PRIMARY KEY,
  type TEXT,          -- 'document' | 'url' | 'note'
  title TEXT,
  content TEXT,       -- extracted text
  source TEXT,        -- file path or URL
  metadata JSON,      -- flexible metadata
  created_at INTEGER,
  updated_at INTEGER
);
```

### knowledge_fts (FTS5 virtual table)
```sql
CREATE VIRTUAL TABLE knowledge_fts USING fts5(
  title, content,
  content=knowledge_items, content_rowid=rowid
);
```

### projects
```sql
CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  name TEXT,
  status TEXT,        -- 'active' | 'stalled' | 'paused' | 'complete'
  description TEXT,
  next_actions TEXT,  -- JSON array
  created_at INTEGER,
  updated_at INTEGER
);
```

### ideas
```sql
CREATE TABLE ideas (
  id TEXT PRIMARY KEY,
  title TEXT,
  description TEXT,
  status TEXT,        -- 'raw' | 'developing' | 'shelved' | 'active'
  notes TEXT,
  created_at INTEGER,
  updated_at INTEGER
);
```

### collections
```sql
CREATE TABLE collections (
  id TEXT PRIMARY KEY,
  name TEXT,
  description TEXT,
  color TEXT,
  created_at INTEGER
);

CREATE TABLE collection_items (
  collection_id TEXT,
  item_id TEXT,
  item_type TEXT,    -- 'knowledge' | 'project' | 'idea'
  PRIMARY KEY (collection_id, item_id, item_type)
);
```

### notifications
```sql
CREATE TABLE notifications (
  id TEXT PRIMARY KEY,
  type TEXT,
  title TEXT,
  body TEXT,
  read INTEGER DEFAULT 0,
  created_at INTEGER
);
```

---

## Alfred's Context System

Alfred receives a rich system prompt that includes:

1. **Persona** — who Alfred is, tone, values
2. **Owner profile** — Josh's projects, goals, preferences
3. **Current context** — recent notifications, active projects, stalled items
4. **Tool definitions** — what Alfred can query/do

Alfred has access to these tool functions:
- `search_knowledge(query)` — full-text search knowledge vault
- `get_projects(status?)` — retrieve projects, optionally filtered
- `get_ideas()` — retrieve idea reservoir
- `get_notifications()` — retrieve unread notifications
- `add_to_knowledge(content, title, type)` — save information
- `create_project(name, description)` — create a project
- `create_idea(title, description)` — add to idea reservoir
- `generate_brief()` — compile executive briefing

---

## File Storage

```
/data/
  valet.db          # SQLite database
/uploads/
  documents/        # Uploaded PDFs and files
  extracted/        # Extracted text versions
```

Both directories are gitignored. SQLite WAL mode enabled for reliability.

---

## API Routes

```
POST /api/chat              # Send message, get Alfred response
GET  /api/chat/[id]         # Get conversation history
GET  /api/brief             # Generate "Brief Me"
POST /api/knowledge         # Add knowledge item (URL or text)
POST /api/knowledge/upload  # Upload file
GET  /api/knowledge/search  # Search knowledge
GET  /api/projects          # List projects
POST /api/projects          # Create project
PUT  /api/projects/[id]     # Update project
GET  /api/ideas             # List ideas
POST /api/ideas             # Create idea
GET  /api/collections       # List collections
GET  /api/notifications     # Get notifications
PUT  /api/notifications/[id]/read  # Mark as read
```

---

## Future Integration Points

Designed for extension without refactoring:

| Integration | Hook Point |
|-------------|-----------|
| Google Calendar | `lib/calendar.ts` → feed into brief context |
| Instapaper | `lib/importers/instapaper.ts` → knowledge ingestion |
| X Bookmarks | `lib/importers/twitter.ts` → knowledge ingestion |
| Email | `lib/importers/email.ts` → knowledge ingestion |
| Shopify | `lib/integrations/shopify.ts` → Smalley metrics |
| Square | `lib/integrations/square.ts` → Smalley metrics |
| n8n | Webhook endpoints → trigger knowledge ingestion |
| Tailscale | Zero-config — bind to 0.0.0.0, Tailscale handles auth |

---

## Deployment

**Local (macOS):**
```bash
npm install
npm run dev      # development
npm run build && npm start   # production
```

**Auto-start (launchd):**
```xml
~/Library/LaunchAgents/com.valet.alfred.plist
```

**Remote access:** Tailscale — expose port 3000, access from any device on the Tailnet
