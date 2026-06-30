#!/usr/bin/env node
'use strict';

const readline = require('readline');
const path = require('path');
const fs = require('fs');
const { makeClient, makeWikiTools } = require('../lib/tools.js');

const WIKI_PATH = process.env.ALFRED_WIKI_PATH
  ? path.resolve(process.env.ALFRED_WIKI_PATH)
  : path.resolve(__dirname, '..', 'wiki');

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';
const client = makeClient();
const tools = makeWikiTools(WIKI_PATH);

const SYSTEM = `You are Alfred conducting a one-time profile interview. Your goal is to learn about the user so you can serve them well in every future session.

Ask ONE question at a time. Wait for the answer before asking the next. Cover these topics across 8–10 questions:
1. Who they are and what they do (work, role, domain)
2. Their main goals this year
3. Current projects they're actively working on
4. How they like to communicate (direct vs. thorough, formal vs. casual)
5. Their biggest strengths and honest weaknesses
6. What they want Alfred to help with most
7. Tools and systems they already use
8. Anything else that would help you serve them better

When you have enough to write a useful profile, call write_file to write wiki/profile.md with clear headers. Keep it factual and specific — no filler. Then say "Profile saved." and nothing else.

Start with your first question now.`;

const WRITE_TOOL = {
  definitions: [tools.definitions.find(t => t.name === 'write_file')],
  execute: tools.execute,
};

const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const CYAN = '\x1b[36m';
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';

function prompt(rl, label) {
  return new Promise(resolve => rl.question(label, resolve));
}

async function streamQuestion(history) {
  process.stdout.write(`\n${CYAN}Alfred:${RESET} `);
  let fullText = '';
  let toolCalls = [];

  const stream = await client.messages.stream({
    model: MODEL,
    max_tokens: 1024,
    system: SYSTEM,
    tools: WRITE_TOOL.definitions,
    messages: history,
  });

  for await (const event of stream) {
    if (event.type === 'content_block_delta') {
      if (event.delta.type === 'text_delta') {
        process.stdout.write(event.delta.text);
        fullText += event.delta.text;
      }
    }
  }

  const response = await stream.finalMessage();

  for (const block of response.content) {
    if (block.type === 'tool_use') toolCalls.push(block);
  }

  if (fullText) process.stdout.write('\n');

  return { response, fullText, toolCalls };
}

async function main() {
  console.log(`\n${BOLD}Alfred Profile Interview${RESET}`);
  console.log('─'.repeat(40));
  console.log(`${DIM}Alfred will ask you a few questions to build your profile.`);
  console.log(`Your answers will be saved to wiki/profile.md.`);
  console.log(`Type your answers and press Enter. Ctrl+C to cancel.${RESET}\n`);

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const history = [{ role: 'user', content: 'Begin the interview.' }];

  try {
    while (true) {
      const { response, fullText, toolCalls } = await streamQuestion(history);

      history.push({ role: 'assistant', content: response.content });

      if (toolCalls.length > 0) {
        const toolResults = [];
        for (const block of toolCalls) {
          let result;
          try { result = WRITE_TOOL.execute(block.name, block.input); }
          catch (err) { result = `Error: ${err.message}`; }
          toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: result });
          if (block.name === 'write_file') {
            console.log(`\n${GREEN}✓ Profile saved to wiki/profile.md${RESET}\n`);
          }
        }
        history.push({ role: 'user', content: toolResults });

        // One more turn to let Claude say "Profile saved." then exit
        const { fullText: closing } = await streamQuestion(history);
        if (closing) process.stdout.write('\n');
        break;
      }

      if (response.stop_reason === 'end_turn' && !fullText.trim()) break;

      const answer = await prompt(rl, `\n${BOLD}You:${RESET} `);
      if (!answer.trim()) continue;
      history.push({ role: 'user', content: answer.trim() });
    }
  } finally {
    rl.close();
  }
}

main().catch(err => {
  console.error(`${RED}Error: ${err.message}${RESET}`);
  process.exit(1);
});
