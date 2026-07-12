-- Valet schema (SQLite). Idempotent: safe to run on every boot.
-- Vector search (chunk_vectors via sqlite-vec) is added in Phase 2, where the
-- extension is loaded at runtime — it is intentionally NOT declared here.

PRAGMA foreign_keys = ON;

-- Every captured thing: a url, an uploaded file, or a typed note.
CREATE TABLE IF NOT EXISTS items (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  type          TEXT NOT NULL CHECK (type IN ('url','file','note')),
  title         TEXT,
  url           TEXT,
  source        TEXT,                  -- manual | instapaper | x | ... (future)
  file_path     TEXT,                  -- for uploads, under data/documents/
  content_hash  TEXT UNIQUE,           -- dedupe: skip re-ingesting the same thing
  text_summary  TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  ingested_at   TEXT
);

-- Retrieval chunks for an item.
CREATE TABLE IF NOT EXISTS chunks (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id  INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  ord      INTEGER NOT NULL,
  content  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_chunks_item ON chunks(item_id);

-- Collections: Projects, Ideas, Reading, Inspiration, Resources, Smalley Coffee.
CREATE TABLE IF NOT EXISTS collections (
  id    INTEGER PRIMARY KEY AUTOINCREMENT,
  name  TEXT NOT NULL UNIQUE,
  kind  TEXT                          -- e.g. system | custom
);

CREATE TABLE IF NOT EXISTS item_collections (
  item_id       INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  collection_id INTEGER NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  PRIMARY KEY (item_id, collection_id)
);

-- Projects Alfred tracks (active vs stalled).
CREATE TABLE IF NOT EXISTS projects (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  name             TEXT NOT NULL UNIQUE,
  status           TEXT NOT NULL DEFAULT 'active'
                     CHECK (status IN ('active','stalled','done','someday')),
  notes            TEXT,
  next_action      TEXT,
  last_activity_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

-- The idea reservoir: never hard-deleted (archive only).
CREATE TABLE IF NOT EXISTS ideas (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT NOT NULL UNIQUE,
  notes       TEXT,
  archived    INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Discovered connections between an idea and a captured item.
CREATE TABLE IF NOT EXISTS idea_links (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  idea_id     INTEGER NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
  item_id     INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  rationale   TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (idea_id, item_id)
);

-- Quiet notification center.
CREATE TABLE IF NOT EXISTS notifications (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  kind        TEXT NOT NULL,          -- deadline | connection | ops | conflict | ...
  title       TEXT NOT NULL,
  body        TEXT,
  importance  INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  read_at     TEXT
);

-- Persisted chat history (the prototype kept this only in RAM).
CREATE TABLE IF NOT EXISTS messages (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  conversation_id  TEXT NOT NULL DEFAULT 'main',
  role             TEXT NOT NULL CHECK (role IN ('user','assistant')),
  content          TEXT NOT NULL,
  created_at       TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id, id);

-- Key/value: schema version, per-source import cursors, etc.
CREATE TABLE IF NOT EXISTS meta (
  key    TEXT PRIMARY KEY,
  value  TEXT
);

-- ── Seeds (idempotent) ───────────────────────────────────────────────────────
INSERT OR IGNORE INTO collections (name, kind) VALUES
  ('Projects','system'), ('Ideas','system'), ('Reading','system'),
  ('Inspiration','system'), ('Resources','system'), ('Smalley Coffee','system');

INSERT OR IGNORE INTO ideas (name) VALUES
  ('Digital Caddie Book'), ('Clubsmanship'), ('Crema'), ('The Paper Filter'),
  ('Grounds for Living'), ('Smalley Website Refresh'), ('Notes From Your Father'),
  ('Coloring Graffiti'), ('Sandwich.Services'), ('Church Project'), ('Soccer Club'),
  ('Cupping Guide'), ('A Man and His Espresso');

INSERT OR IGNORE INTO meta (key, value) VALUES ('schema_version','1');
