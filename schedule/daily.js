#!/usr/bin/env node
'use strict';

const path = require('path');
const fs = require('fs');
const { makeClient, makeWikiTools, runAgent } = require('../lib/tools.js');

const WIKI_PATH = process.env.ALFRED_WIKI_PATH
  ? path.resolve(process.env.ALFRED_WIKI_PATH)
  : path.resolve(__dirname, '..', 'wiki');

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';
const client = makeClient();
const tools = makeWikiTools(WIKI_PATH);

function loadSchema() {
  try { return fs.readFileSync(path.join(WIKI_PATH, 'CLAUDE.md'), 'utf8'); } catch { return ''; }
}

function loadProfile() {
  try { return fs.readFileSync(path.join(WIKI_PATH, 'profile.md'), 'utf8'); } catch { return ''; }
}

function buildSystem() {
  const parts = [loadSchema(), loadProfile()].filter(Boolean);
  return parts.join('\n\n---\n\n') || 'You are Alfred, a personal AI assistant.';
}

function findNewSources() {
  const rawDir = path.join(WIKI_PATH, 'raw');
  const sourcesDir = path.join(WIKI_PATH, 'sources');
  if (!fs.existsSync(rawDir)) return [];

  const existing = fs.existsSync(sourcesDir)
    ? new Set(fs.readdirSync(sourcesDir).map(f => f.replace(/\.md$/, '')))
    : new Set();

  return fs.readdirSync(rawDir).filter(f => {
    const slug = f.replace(/\.[^.]+$/, '').toLowerCase().replace(/[^a-z0-9]+/g, '-');
    return !existing.has(slug);
  });
}

function log(msg) {
  const ts = new Date().toISOString();
  process.stdout.write(`[${ts}] ${msg}\n`);
}

async function run() {
  log('Daily run starting');

  const newFiles = findNewSources();
  log(`New files in raw/: ${newFiles.length > 0 ? newFiles.join(', ') : 'none'}`);

  const tasks = [];

  if (newFiles.length > 0) {
    tasks.push(
      `Ingest each of these new files from raw/: ${newFiles.join(', ')}. ` +
      `For each: create a source page in sources/, update or create entity and concept pages, ` +
      `update index.md, and append an entry to log.md.`
    );
  }

  tasks.push(
    'Run a lint pass on the wiki: check for orphan pages, dead wikilinks, and concept pages ' +
    'covered by only one source. Log any issues found to log.md.'
  );

  // Contradiction check — only if there are concepts and sources
  const conceptsDir = path.join(WIKI_PATH, 'concepts');
  const sourcesDir = path.join(WIKI_PATH, 'sources');
  const hasConceptPages = fs.existsSync(conceptsDir) &&
    fs.readdirSync(conceptsDir).some(f => f.endsWith('.md') && !f.startsWith('.'));
  if (hasConceptPages) {
    const today = new Date().toISOString().slice(0, 10);
    tasks.push(
      `Run a contradiction check: read all files in concepts/, then read all source pages in sources/ modified in the last 30 days. ` +
      `For each concept, check whether any recent source contradicts, complicates, or materially updates that position. ` +
      `Do NOT look for agreement. If no conflict for a concept, write "Clear." ` +
      `Write the full report to queries/contradictions-${today}.md and append a one-line entry to log.md.`
    );
  }

  tasks.push(
    `Update hot.md to reflect the last 7 days of activity from log.md plus today's run. ` +
    `Keep it under 400 words. Include today's date (${new Date().toISOString().slice(0, 10)}).`
  );

  const prompt = tasks.join('\n\n');

  log('Running agent…');
  const reply = await runAgent({
    client,
    model: MODEL,
    system: buildSystem(),
    tools,
    messages: [{ role: 'user', content: prompt }],
    onActivity: msg => log(msg),
  });

  log('Agent reply: ' + reply.slice(0, 200).replace(/\n/g, ' '));
  log('Daily run complete');
}

run().catch(err => {
  process.stderr.write(`[ERROR] ${err.message}\n`);
  process.exit(1);
});
