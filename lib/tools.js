const fs = require('fs');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');

function makeClient(apiKey) {
  return new Anthropic({ apiKey: apiKey || process.env.ANTHROPIC_API_KEY });
}

function makeWikiTools(wikiPath) {
  function safePath(p) {
    const resolved = path.resolve(wikiPath, p);
    if (!resolved.startsWith(wikiPath + path.sep) && resolved !== wikiPath) {
      throw new Error(`Path outside wiki: ${p}`);
    }
    return resolved;
  }

  function readFile({ path: p }) {
    const abs = safePath(p);
    if (!fs.existsSync(abs)) return `File not found: ${p}`;
    return fs.readFileSync(abs, 'utf8');
  }

  function writeFile({ path: p, content }) {
    const abs = safePath(p);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content, 'utf8');
    return `Written: ${p}`;
  }

  function appendFile({ path: p, content }) {
    const abs = safePath(p);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.appendFileSync(abs, content, 'utf8');
    return `Appended to: ${p}`;
  }

  function listDirectory({ path: p = '' }) {
    const abs = safePath(p || '.');
    if (!fs.existsSync(abs)) return `Directory not found: ${p}`;
    return fs.readdirSync(abs, { withFileTypes: true })
      .map(e => (e.isDirectory() ? `${e.name}/` : e.name))
      .join('\n') || '(empty)';
  }

  function searchWiki({ query }) {
    const results = [];
    function walk(dir) {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) { walk(full); continue; }
        if (!e.name.endsWith('.md')) continue;
        const lines = fs.readFileSync(full, 'utf8').split('\n');
        const rel = path.relative(wikiPath, full);
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].toLowerCase().includes(query.toLowerCase())) {
            results.push(`${rel}:${i + 1}: ${lines[i].trim()}`);
          }
        }
      }
    }
    try { walk(wikiPath); } catch { return 'Search failed'; }
    return results.length ? results.join('\n') : 'No matches found';
  }

  const definitions = [
    {
      name: 'read_file',
      description: 'Read a file from the wiki. Path relative to wiki root.',
      input_schema: {
        type: 'object',
        properties: { path: { type: 'string' } },
        required: ['path'],
      },
    },
    {
      name: 'write_file',
      description: 'Create or overwrite a file in the wiki. Path relative to wiki root.',
      input_schema: {
        type: 'object',
        properties: {
          path: { type: 'string' },
          content: { type: 'string' },
        },
        required: ['path', 'content'],
      },
    },
    {
      name: 'append_to_file',
      description: 'Append text to a file in the wiki.',
      input_schema: {
        type: 'object',
        properties: {
          path: { type: 'string' },
          content: { type: 'string' },
        },
        required: ['path', 'content'],
      },
    },
    {
      name: 'list_directory',
      description: 'List files in the wiki. Path relative to wiki root; omit for root.',
      input_schema: {
        type: 'object',
        properties: { path: { type: 'string' } },
      },
    },
    {
      name: 'search_wiki',
      description: 'Search all markdown files in the wiki for a term.',
      input_schema: {
        type: 'object',
        properties: { query: { type: 'string' } },
        required: ['query'],
      },
    },
  ];

  function execute(name, input) {
    switch (name) {
      case 'read_file':      return readFile(input);
      case 'write_file':     return writeFile(input);
      case 'append_to_file': return appendFile(input);
      case 'list_directory': return listDirectory(input);
      case 'search_wiki':    return searchWiki(input);
      default: return `Unknown tool: ${name}`;
    }
  }

  return { definitions, execute };
}

function toolLabel(name, input) {
  switch (name) {
    case 'read_file':      return `Reading ${input.path}…`;
    case 'write_file':     return `Writing ${input.path}…`;
    case 'append_to_file': return `Updating ${input.path}…`;
    case 'list_directory': return `Listing ${input.path || 'wiki/'}…`;
    case 'search_wiki':    return `Searching for "${input.query}"…`;
    default: return `${name}…`;
  }
}

async function runAgent({ client, model, system, tools, messages, onActivity = () => {}, maxRounds = 20 }) {
  const history = [...messages];

  for (let round = 0; round < maxRounds; round++) {
    const response = await client.messages.create({
      model,
      max_tokens: 4096,
      system,
      tools: tools.definitions,
      messages: history,
    });

    const textBlocks = response.content.filter(b => b.type === 'text');
    const toolBlocks = response.content.filter(b => b.type === 'tool_use');

    if (response.stop_reason === 'end_turn' || toolBlocks.length === 0) {
      return textBlocks.map(b => b.text).join('') || '(done)';
    }

    history.push({ role: 'assistant', content: response.content });

    const toolResults = [];
    for (const block of toolBlocks) {
      onActivity(toolLabel(block.name, block.input));
      let result;
      try { result = tools.execute(block.name, block.input); }
      catch (err) { result = `Error: ${err.message}`; }
      toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: result });
    }

    history.push({ role: 'user', content: toolResults });
  }

  return '(reached tool call limit)';
}

module.exports = { makeClient, makeWikiTools, toolLabel, runAgent };
