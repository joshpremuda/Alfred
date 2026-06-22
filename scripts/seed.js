#!/usr/bin/env node
/**
 * Seed the Valet database with Josh's initial projects and ideas.
 * Run: node scripts/seed.js
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });
const DB_PATH = path.join(DATA_DIR, 'valet.db');

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Run migrations inline
db.exec(`
  CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    title TEXT,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch())
  );
  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS knowledge_items (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL DEFAULT 'note',
    title TEXT NOT NULL,
    content TEXT NOT NULL DEFAULT '',
    source TEXT,
    metadata TEXT DEFAULT '{}',
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch())
  );
  CREATE VIRTUAL TABLE IF NOT EXISTS knowledge_fts USING fts5(
    title, content,
    content=knowledge_items, content_rowid=rowid,
    tokenize='porter ascii'
  );
  CREATE TRIGGER IF NOT EXISTS knowledge_fts_insert
    AFTER INSERT ON knowledge_items BEGIN
      INSERT INTO knowledge_fts(rowid, title, content) VALUES (new.rowid, new.title, new.content);
    END;
  CREATE TRIGGER IF NOT EXISTS knowledge_fts_delete
    AFTER DELETE ON knowledge_items BEGIN
      INSERT INTO knowledge_fts(knowledge_fts, rowid, title, content) VALUES ('delete', old.rowid, old.title, old.content);
    END;
  CREATE TRIGGER IF NOT EXISTS knowledge_fts_update
    AFTER UPDATE ON knowledge_items BEGIN
      INSERT INTO knowledge_fts(knowledge_fts, rowid, title, content) VALUES ('delete', old.rowid, old.title, old.content);
      INSERT INTO knowledge_fts(rowid, title, content) VALUES (new.rowid, new.title, new.content);
    END;
  CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    description TEXT DEFAULT '',
    next_actions TEXT DEFAULT '[]',
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch())
  );
  CREATE TABLE IF NOT EXISTS ideas (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    status TEXT NOT NULL DEFAULT 'raw',
    notes TEXT DEFAULT '',
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at INTEGER NOT NULL DEFAULT (unixepoch())
  );
  CREATE TABLE IF NOT EXISTS collections (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    color TEXT DEFAULT '#6B7280',
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  );
  CREATE TABLE IF NOT EXISTS collection_items (
    collection_id TEXT NOT NULL,
    item_id TEXT NOT NULL,
    item_type TEXT NOT NULL,
    PRIMARY KEY (collection_id, item_id, item_type),
    FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL DEFAULT 'info',
    title TEXT NOT NULL,
    body TEXT DEFAULT '',
    read INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  );
`);

function insert(table, data) {
  const keys = Object.keys(data);
  const placeholders = keys.map(() => '?').join(', ');
  const values = keys.map(k => data[k]);
  try {
    db.prepare(`INSERT OR IGNORE INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})`).run(...values);
    return true;
  } catch (e) {
    console.warn(`  Skipped (${e.message})`);
    return false;
  }
}

console.log('\n🌱 Seeding Valet database...\n');

// ── Projects ────────────────────────────────────────────────────────────────
const projects = [
  {
    name: 'Smalley Coffee',
    status: 'active',
    description: 'Specialty coffee brand. Primary operating business.',
    next_actions: JSON.stringify([
      'Review monthly sales metrics',
      'Plan Q3 product lineup',
      'Update website content',
    ]),
  },
  {
    name: 'Crema',
    status: 'active',
    description: 'Coffee media property. Exploring brand + content strategy.',
    next_actions: JSON.stringify([
      'Define editorial voice and content pillars',
      'Identify audience and distribution channels',
      'Draft first content pieces',
    ]),
  },
  {
    name: 'Paper Filter',
    status: 'active',
    description: 'Coffee-adjacent media or product concept.',
    next_actions: JSON.stringify([
      'Clarify concept and differentiation from Crema',
      'Map target audience',
    ]),
  },
  {
    name: 'Digital Caddie Book',
    status: 'active',
    description: 'Golf-focused digital product. Caddie notes and course management tool.',
    next_actions: JSON.stringify([
      'Define core feature set for MVP',
      'Research existing golf apps and gaps',
      'Sketch initial user flows',
    ]),
  },
  {
    name: 'Clubsmanship',
    status: 'active',
    description: 'Golf brand or media concept. Exploring positioning.',
    next_actions: JSON.stringify([
      'Define what Clubsmanship is (product, media, community?)',
      'Research comparable brands',
    ]),
  },
];

console.log('Projects:');
for (const p of projects) {
  const id = uuidv4();
  const ok = insert('projects', { id, ...p });
  if (ok) console.log(`  ✓ ${p.name}`);
}

// ── Ideas ────────────────────────────────────────────────────────────────────
const ideas = [
  { title: 'Digital Caddie Book', description: 'A digital version of the traditional caddie yardage book. Course management, notes, and data for serious golfers.', status: 'active' },
  { title: 'Clubsmanship', description: 'A golf brand centered on the culture of the game — craft, tradition, and style.', status: 'active' },
  { title: 'Crema', description: 'A coffee media property. Editorial, not transactional.', status: 'active' },
  { title: 'Paper Filter', description: 'Coffee content or product concept. The filter as metaphor for quality and patience.', status: 'developing' },
  { title: 'Grounds for Living', description: 'Coffee lifestyle brand or content series. Coffee as a lens on how we live.', status: 'raw' },
  { title: 'Smalley Website Refresh', description: 'Redesign the Smalley Coffee web presence. More editorial, less e-commerce template.', status: 'developing' },
  { title: 'Notes From Your Father', description: 'A content or product concept. Personal correspondence, wisdom, legacy.', status: 'raw' },
  { title: 'Coloring Graffiti', description: 'Creative project. Exploring graffiti aesthetics through a more accessible medium.', status: 'raw' },
  { title: 'Sandwich.Services', description: 'A playful or earnest services business concept. The sandwich as metaphor.', status: 'raw' },
  { title: 'Church Project', description: 'A creative or community project connected to faith and practice.', status: 'raw' },
  { title: 'Soccer Club', description: 'A local or concept soccer club. Community, brand, culture.', status: 'raw' },
];

console.log('\nIdeas:');
for (const idea of ideas) {
  const id = uuidv4();
  const ok = insert('ideas', { id, ...idea, notes: '' });
  if (ok) console.log(`  ✓ ${idea.title}`);
}

// ── Collections ──────────────────────────────────────────────────────────────
const collections = [
  { name: 'Projects', description: 'Active project materials', color: '#2563EB' },
  { name: 'Ideas', description: 'Ideas and inspiration', color: '#7C3AED' },
  { name: 'Reading', description: 'Articles and long-form content', color: '#059669' },
  { name: 'Inspiration', description: 'Visual and creative references', color: '#D97706' },
  { name: 'Resources', description: 'Reference materials and tools', color: '#DC2626' },
  { name: 'Smalley Coffee', description: 'Everything Smalley', color: '#92400E' },
];

console.log('\nCollections:');
for (const col of collections) {
  const id = uuidv4();
  const ok = insert('collections', { id, ...col });
  if (ok) console.log(`  ✓ ${col.name}`);
}

// ── Welcome notification ─────────────────────────────────────────────────────
const notifId = uuidv4();
insert('notifications', {
  id: notifId,
  type: 'info',
  title: 'Welcome to Valet',
  body: 'Your knowledge vault, projects, and ideas have been seeded. Say hello to Alfred.',
  read: 0,
});

console.log('\n✅ Seed complete. Run `npm run dev` to start Valet.\n');
db.close();
