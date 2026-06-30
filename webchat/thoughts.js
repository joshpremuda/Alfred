const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const STORE = path.join(__dirname, '..', 'data', 'thoughts.json');

function load() {
  try {
    fs.mkdirSync(path.dirname(STORE), { recursive: true });
    return JSON.parse(fs.readFileSync(STORE, 'utf8'));
  } catch {
    return [];
  }
}

function save(thoughts) {
  fs.mkdirSync(path.dirname(STORE), { recursive: true });
  fs.writeFileSync(STORE, JSON.stringify(thoughts, null, 2));
}

function capture({ content, tags = [], source = 'web', links = [] }) {
  const thoughts = load();
  const thought = {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    content,
    tags,
    source,
    links,
    status: 'raw',
  };
  thoughts.unshift(thought);
  save(thoughts);
  return thought;
}

function search({ query, tags, status, limit = 20 } = {}) {
  let thoughts = load();
  if (status) thoughts = thoughts.filter(t => t.status === status);
  if (tags && tags.length) thoughts = thoughts.filter(t => tags.some(tag => t.tags.includes(tag)));
  if (query) {
    const q = query.toLowerCase();
    thoughts = thoughts.filter(t =>
      t.content.toLowerCase().includes(q) ||
      t.tags.some(tag => tag.toLowerCase().includes(q))
    );
  }
  return thoughts.slice(0, limit);
}

function update(id, patch) {
  const thoughts = load();
  const idx = thoughts.findIndex(t => t.id === id);
  if (idx === -1) return null;
  thoughts[idx] = { ...thoughts[idx], ...patch };
  save(thoughts);
  return thoughts[idx];
}

function getById(id) {
  return load().find(t => t.id === id) || null;
}

function linkThoughts(idA, idB) {
  const thoughts = load();
  const a = thoughts.find(t => t.id === idA);
  const b = thoughts.find(t => t.id === idB);
  if (!a || !b) return false;
  if (!a.links.includes(idB)) a.links.push(idB);
  if (!b.links.includes(idA)) b.links.push(idA);
  save(thoughts);
  return true;
}

// Build a readable digest for Alfred to synthesize
function digest({ query, tags, status, limit } = {}) {
  const results = search({ query, tags, status, limit });
  if (!results.length) return 'No thoughts found.';
  return results.map(t => {
    const meta = [t.timestamp.slice(0, 10)];
    if (t.tags.length) meta.push(`tags: ${t.tags.join(', ')}`);
    if (t.status !== 'raw') meta.push(`status: ${t.status}`);
    return `[${meta.join(' | ')}]\n${t.content}`;
  }).join('\n\n');
}

module.exports = { capture, search, update, getById, linkThoughts, digest };
