'use strict';
// Intent router — classifies Telegram messages using Haiku
// Returns one of: BRIEFING | CRM | DESIGN | POLYMARKET | UNKNOWN

const Anthropic = require('@anthropic-ai/sdk');

const INTENTS = ['BRIEFING', 'CRM', 'DESIGN', 'POLYMARKET', 'UNKNOWN'];

const SYSTEM_PROMPT = `You are an intent classifier for a personal assistant bot.
Classify the user message into exactly one of these intents:
- BRIEFING: asking about today's schedule, emails, news, or morning briefing
- CRM: anything about contacts, follow-ups, wholesale leads, email drafts, or the sales pipeline
- DESIGN: requests for graphics, social posts, images, coffee bag mockups, or visual content
- POLYMARKET: anything about prediction markets, bets, paper trades, or market research
- UNKNOWN: anything else

Respond with only the intent word, nothing else.`;

let _client;
function getClient() {
  if (!_client) {
    _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return _client;
}

async function classifyIntent(userMessage) {
  try {
    const msg = await getClient().messages.create({
      model: process.env.HAIKU_MODEL || 'claude-haiku-4-5-20251001',
      max_tokens: 20,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    });
    const raw = (msg.content[0]?.text || '').trim().toUpperCase();
    return INTENTS.includes(raw) ? raw : 'UNKNOWN';
  } catch (err) {
    console.error('[intent] classification error:', err.message);
    return 'UNKNOWN';
  }
}

module.exports = { classifyIntent };
