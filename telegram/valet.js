'use strict';
// Smalley VALET — Telegram Command Hub
// Phase 2: Intent router + agent dispatcher
// Phase 3: Daily briefing cron
// Phase 4: CRM watcher + follow-up approval flow
// Phase 5: Design agent

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const TelegramBot = require('node-telegram-bot-api');
const { CronJob } = require('cron');
const Anthropic = require('@anthropic-ai/sdk');
const { classifyIntent } = require('../agents/intent');
const { generateBriefing } = require('../agents/briefing');
const crm = require('../agents/crm');
const { createDesign } = require('../agents/design');

// ── Config ────────────────────────────────────────────────────────────────
const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const OWNER_ID = parseInt(process.env.TELEGRAM_OWNER_ID || '0', 10);
const TZ = process.env.TZ || 'America/Chicago';

if (!TOKEN) {
  console.error('[VALET] TELEGRAM_BOT_TOKEN is required');
  process.exit(1);
}

const bot = new TelegramBot(TOKEN, { polling: true });

// ── Pending approval flows ─────────────────────────────────────────────────
// key: chatId, value: { type, data }
const pendingApprovals = new Map();

// ── Owner guard ───────────────────────────────────────────────────────────
function isOwner(msg) {
  return !OWNER_ID || msg.from?.id === OWNER_ID;
}

function send(chatId, text, opts = {}) {
  return bot.sendMessage(chatId, text, { parse_mode: 'Markdown', ...opts });
}

// ── General assistant (UNKNOWN intent) ───────────────────────────────────
let _ai;
function getAI() {
  if (!_ai) _ai = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _ai;
}

const generalSessions = new Map(); // chatId → message history

async function handleGeneral(chatId, userText) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return send(chatId, "I can't respond right now — ANTHROPIC_API_KEY not configured.");
  }
  const history = generalSessions.get(chatId) || [];
  history.push({ role: 'user', content: userText });

  const msg = await getAI().messages.create({
    model: process.env.SONNET_MODEL || 'claude-sonnet-4-6',
    max_tokens: 500,
    system: `You are VALET, a personal assistant for Josh Premuda, owner of Smalley Coffee in Jasper, Indiana. Smalley Coffee is a craft roaster established in 2014. Be concise, direct, and helpful. Keep responses under 200 words unless detail is specifically requested.`,
    messages: history,
  });
  const reply = msg.content[0]?.text || '(no response)';
  history.push({ role: 'assistant', content: reply });
  // Keep last 10 turns
  if (history.length > 20) history.splice(0, history.length - 20);
  generalSessions.set(chatId, history);
  return send(chatId, reply);
}

// ── CRM follow-up flow ────────────────────────────────────────────────────
async function runFollowupCycle(chatId) {
  const contacts = await crm.getContactsNeedingFollowup();
  if (!contacts.length) {
    return send(chatId, '✅ No follow-ups needed today. Pipeline is fresh.');
  }
  // Queue them one at a time
  await processNextFollowup(chatId, contacts, 0);
}

async function processNextFollowup(chatId, contacts, index) {
  if (index >= contacts.length) {
    return send(chatId, `✅ Done — reviewed ${contacts.length} follow-up(s).`);
  }
  const contact = contacts[index];
  let draft;
  try {
    draft = await crm.draftFollowup(contact);
  } catch (err) {
    draft = `(Draft failed: ${err.message})`;
  }

  // Parse subject line from draft
  const lines = draft.split('\n');
  const subjectLine = lines.find((l) => l.startsWith('Subject:')) || '';
  const body = lines.filter((l) => !l.startsWith('Subject:')).join('\n').trim();

  pendingApprovals.set(chatId, {
    type: 'followup',
    data: { contact, draft, subject: subjectLine.replace('Subject:', '').trim(), body },
    queue: contacts,
    queueIndex: index,
  });

  const draftText = `📧 *Follow-up draft for ${contact.name} (${contact.company})*\n\n${draft}\n\n` +
    `Reply:\n• *SEND* — send this email\n• *EDIT [changes]* — revise it\n• *SKIP* — move on`;

  await send(chatId, draftText);
}

// ── Approval handler ──────────────────────────────────────────────────────
async function handleApproval(chatId, text) {
  const pending = pendingApprovals.get(chatId);
  if (!pending) return false; // not in an approval flow

  const upper = text.trim().toUpperCase();

  if (pending.type === 'followup') {
    const { contact, subject, body, queue, queueIndex } = pending.data;

    if (upper === 'SEND') {
      pendingApprovals.delete(chatId);
      try {
        await crm.sendEmail({ to: contact.email, subject, body });
        await crm.touchContact(contact.id);
        await send(chatId, `✅ Sent to ${contact.name} at ${contact.company}.`);
      } catch (err) {
        await send(chatId, `❌ Send failed: ${err.message}`);
      }
      await processNextFollowup(chatId, queue, queueIndex + 1);
      return true;
    }

    if (upper === 'SKIP') {
      pendingApprovals.delete(chatId);
      await send(chatId, `⏭ Skipped ${contact.name}.`);
      await processNextFollowup(chatId, queue, queueIndex + 1);
      return true;
    }

    if (upper.startsWith('EDIT ')) {
      const editNote = text.slice(5).trim();
      await send(chatId, '✍️ Revising…');
      try {
        const revised = await crm.draftFollowup(contact, editNote);
        pending.data.draft = revised;
        const lines = revised.split('\n');
        pending.data.subject = (lines.find((l) => l.startsWith('Subject:')) || '').replace('Subject:', '').trim();
        pending.data.body = lines.filter((l) => !l.startsWith('Subject:')).join('\n').trim();
        pendingApprovals.set(chatId, pending);
        await send(chatId, `📧 *Revised draft:*\n\n${revised}\n\nReply *SEND*, *EDIT [changes]*, or *SKIP*.`);
      } catch (err) {
        await send(chatId, `❌ Revision failed: ${err.message}`);
      }
      return true;
    }
  }

  if (pending.type === 'design') {
    const { result, originalRequest } = pending.data;

    if (upper === 'SAVE') {
      pendingApprovals.delete(chatId);
      await send(chatId, `✅ Saved. Image URL: ${result.imageUrl}`);
      return true;
    }

    if (upper === 'REDO') {
      pendingApprovals.delete(chatId);
      await send(chatId, '🎨 Regenerating…');
      await handleDesign(chatId, originalRequest);
      return true;
    }

    // Any other text = description of changes
    pendingApprovals.delete(chatId);
    await send(chatId, '🎨 Creating revised version…');
    await handleDesign(chatId, originalRequest, text);
    return true;
  }

  return false;
}

// ── Intent handlers ───────────────────────────────────────────────────────
async function handleBriefing(chatId) {
  await send(chatId, '☀️ Pulling your briefing…');
  try {
    const briefing = await generateBriefing();
    await send(chatId, briefing);
  } catch (err) {
    await send(chatId, `❌ Briefing error: ${err.message}`);
  }
}

async function handleCRM(chatId, userText) {
  const lower = userText.toLowerCase();

  if (lower.includes('pipeline') || lower.includes('show pipeline')) {
    const overview = await crm.getPipelineOverview();
    return send(chatId, `📊 *Pipeline*\n\n${overview}`);
  }

  if (lower.includes('follow-up') || lower.includes('followup') || lower.includes('follow up')) {
    await send(chatId, '📋 Checking who needs a follow-up…');
    return runFollowupCycle(chatId);
  }

  // Default: let Sonnet handle the CRM query
  return handleGeneral(chatId, userText);
}

async function handleDesign(chatId, userText, styleNotes = '') {
  await send(chatId, '🎨 Creating your design…');
  try {
    const result = await createDesign(userText, styleNotes);
    pendingApprovals.set(chatId, {
      type: 'design',
      data: { result, originalRequest: userText },
    });
    await bot.sendPhoto(chatId, result.imageUrl, {
      caption: `Here's your *${result.type}* for "${result.subject}"\n\nReply *SAVE* to keep, *REDO* to regenerate, or describe changes.`,
      parse_mode: 'Markdown',
    });
  } catch (err) {
    await send(chatId, `❌ Design error: ${err.message}`);
  }
}

// ── Message router ────────────────────────────────────────────────────────
bot.on('message', async (msg) => {
  if (!isOwner(msg)) return; // Ignore non-owner messages silently

  const chatId = msg.chat.id;
  const text = msg.text || '';
  if (!text) return;

  // Check if we're in an approval flow first
  const handled = await handleApproval(chatId, text);
  if (handled) return;

  // Classify intent
  let intent;
  try {
    intent = await classifyIntent(text);
  } catch {
    intent = 'UNKNOWN';
  }

  console.log(`[VALET] Message: "${text.slice(0, 60)}" → Intent: ${intent}`);

  switch (intent) {
    case 'BRIEFING':
      await handleBriefing(chatId);
      break;
    case 'CRM':
      await handleCRM(chatId, text);
      break;
    case 'DESIGN':
      await handleDesign(chatId, text);
      break;
    case 'POLYMARKET':
      await send(chatId, '📈 Polymarket research is coming in Phase 6. Check back soon.');
      break;
    default:
      await handleGeneral(chatId, text);
  }
});

bot.on('polling_error', (err) => {
  console.error('[VALET] Polling error:', err.message);
});

// ── Scheduled jobs ────────────────────────────────────────────────────────
function startScheduledJobs() {
  // Daily briefing at 7:00 AM Central
  new CronJob('0 7 * * *', async () => {
    if (!OWNER_ID) return;
    console.log('[VALET] Sending scheduled morning briefing');
    await handleBriefing(OWNER_ID);
  }, null, true, TZ);

  // Follow-up drafts at 9:00 AM Central
  new CronJob('0 9 * * *', async () => {
    if (!OWNER_ID) return;
    console.log('[VALET] Running daily follow-up check');
    await runFollowupCycle(OWNER_ID);
  }, null, true, TZ);

  console.log('[VALET] Scheduled jobs active (7am briefing, 9am follow-ups)');
}

// ── Startup ───────────────────────────────────────────────────────────────
async function main() {
  console.log('[VALET] Starting Smalley VALET…');

  // Load Notion DB IDs if configured
  if (process.env.NOTION_CONTACTS_DB_ID || process.env.NOTION_PIPELINE_DB_ID) {
    crm.setDbIds(process.env.NOTION_CONTACTS_DB_ID, process.env.NOTION_PIPELINE_DB_ID);
  }

  startScheduledJobs();

  // Send startup confirmation to owner
  if (OWNER_ID) {
    try {
      await bot.sendMessage(OWNER_ID,
        '🤵 *VALET is online.*\n\nYour AI staff is ready. Commands:\n' +
        '• "briefing" — morning report on demand\n' +
        '• "follow-ups" — draft follow-up emails\n' +
        '• "pipeline" — see your sales pipeline\n' +
        '• "make a [post/image] for [subject]" — design\n' +
        '• Anything else — general assistant\n\n' +
        '_Scheduled: 7am briefing · 9am follow-ups_',
        { parse_mode: 'Markdown' }
      );
    } catch {
      // Don't crash on startup message failure
    }
  }

  console.log('[VALET] Ready. Polling for messages…');
}

main().catch((err) => {
  console.error('[VALET] Fatal startup error:', err);
  process.exit(1);
});
