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

function readWikiFile(name) {
  try { return fs.readFileSync(path.join(WIKI_PATH, name), 'utf8'); } catch { return ''; }
}

function buildSystem() {
  const parts = [readWikiFile('CLAUDE.md'), readWikiFile('profile.md')].filter(Boolean);
  return parts.join('\n\n---\n\n') || 'You are Alfred, a personal AI assistant.';
}

function listDir(subdir) {
  const dir = path.join(WIKI_PATH, subdir);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.md') && !f.startsWith('.'))
    .map(f => path.join(subdir, f));
}

function recentSources(days = 30) {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return listDir('sources').filter(f => {
    try {
      return fs.statSync(path.join(WIKI_PATH, f)).mtimeMs >= cutoff;
    } catch { return false; }
  });
}

function log(msg) {
  process.stdout.write(`[${new Date().toISOString()}] ${msg}\n`);
}

async function run() {
  log('Contradiction check starting');

  const concepts = listDir('concepts');
  const sources = recentSources(30);

  log(`Concepts: ${concepts.length}  Recent sources (30d): ${sources.length}`);

  if (concepts.length === 0) {
    log('No concept pages yet — nothing to check');
    return;
  }
  if (sources.length === 0) {
    log('No source pages modified in last 30 days — nothing to check');
    return;
  }

  const today = new Date().toISOString().slice(0, 10);
  const outPath = `queries/contradictions-${today}.md`;

  const prompt =
    `Read all concept pages (these are established positions and theses):\n` +
    concepts.map(f => `- ${f}`).join('\n') +
    `\n\nRead all source pages modified in the last 30 days (these are recent evidence):\n` +
    sources.map(f => `- ${f}`).join('\n') +
    `\n\nYour only job is contradiction. For each concept page, check whether any recent source contradicts, complicates, or materially updates that position.\n` +
    `Do NOT look for agreement. Do NOT summarise.\n` +
    `If there is no conflict for a concept, write exactly: Clear.\n` +
    `If there is conflict, quote the specific claim from the concept page and the specific conflicting passage from the source, with [[wikilinks]] to both.\n\n` +
    `When done, write the full report to ${outPath} and append a one-line entry to log.md.`;

  const reply = await runAgent({
    client,
    model: MODEL,
    system: buildSystem(),
    tools,
    messages: [{ role: 'user', content: prompt }],
    onActivity: msg => log(msg),
  });

  log('Done: ' + reply.slice(0, 200).replace(/\n/g, ' '));
  log(`Report: wiki/${outPath}`);
}

run().catch(err => {
  process.stderr.write(`[ERROR] ${err.message}\n`);
  process.exit(1);
});
