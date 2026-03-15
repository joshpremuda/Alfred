'use strict';
// CRM Agent — Notion contacts, email classification, follow-up drafting

const Anthropic = require('@anthropic-ai/sdk');
const { Client: NotionClient } = require('@notionhq/client');
const axios = require('axios');

let _ai, _notion;
function getAI() {
  if (!_ai) _ai = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _ai;
}
function getNotion() {
  if (!_notion) _notion = new NotionClient({ auth: process.env.NOTION_TOKEN });
  return _notion;
}

// Database IDs (set after setup-notion.js runs)
let CONTACTS_DB_ID = process.env.NOTION_CONTACTS_DB_ID || '';
let PIPELINE_DB_ID = process.env.NOTION_PIPELINE_DB_ID || '';

// ── Email classification ──────────────────────────────────────────────────
async function isWholesaleLead(email) {
  const msg = await getAI().messages.create({
    model: process.env.HAIKU_MODEL || 'claude-haiku-4-5-20251001',
    max_tokens: 5,
    system: 'You classify emails. Reply YES or NO only.',
    messages: [{
      role: 'user',
      content: `Does this email appear to be from a potential wholesale coffee customer, café, or restaurant?\n\nFrom: ${email.from}\nSubject: ${email.subject}\nBody preview: ${email.snippet}`
    }],
  });
  return (msg.content[0]?.text || '').trim().toUpperCase().startsWith('YES');
}

// ── Contact extraction ────────────────────────────────────────────────────
async function extractContactInfo(email) {
  const msg = await getAI().messages.create({
    model: process.env.HAIKU_MODEL || 'claude-haiku-4-5-20251001',
    max_tokens: 200,
    system: 'Extract contact info from an email. Reply with JSON only: {"name":"","company":"","email":"","phone":""}. Use empty string for unknown fields.',
    messages: [{
      role: 'user',
      content: `From: ${email.from}\nSubject: ${email.subject}\nBody: ${email.body || email.snippet}`
    }],
  });
  try {
    const raw = msg.content[0]?.text || '{}';
    return JSON.parse(raw.replace(/```json?\n?/g, '').replace(/```/g, '').trim());
  } catch {
    return { name: '', company: '', email: email.from, phone: '' };
  }
}

// ── Notion: create contact ────────────────────────────────────────────────
async function createContact({ name, company, email, phone, source = 'email', notes = '' }) {
  if (!CONTACTS_DB_ID) {
    console.error('[crm] NOTION_CONTACTS_DB_ID not set');
    return null;
  }
  try {
    const page = await getNotion().pages.create({
      parent: { database_id: CONTACTS_DB_ID },
      properties: {
        Name: { title: [{ text: { content: name || 'Unknown' } }] },
        Company: { rich_text: [{ text: { content: company || '' } }] },
        Email: { email: email || null },
        Phone: { phone_number: phone || null },
        Source: { select: { name: source } },
        Status: { select: { name: 'prospect' } },
        'Last Contact': { date: { start: new Date().toISOString().split('T')[0] } },
        Notes: { rich_text: [{ text: { content: notes } }] },
      },
    });
    return page.id;
  } catch (err) {
    console.error('[crm] createContact error:', err.message);
    return null;
  }
}

// ── Notion: get contacts needing follow-up ────────────────────────────────
async function getContactsNeedingFollowup() {
  if (!CONTACTS_DB_ID) return [];
  try {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 7);
    const cutoffStr = cutoff.toISOString().split('T')[0];

    const res = await getNotion().databases.query({
      database_id: CONTACTS_DB_ID,
      filter: {
        and: [
          { property: 'Status', select: { is_one_of: ['prospect', 'sampled'] } },
          { property: 'Last Contact', date: { on_or_before: cutoffStr } },
        ],
      },
    });
    return res.results.map((p) => ({
      id: p.id,
      name: p.properties.Name?.title?.[0]?.text?.content || 'Unknown',
      company: p.properties.Company?.rich_text?.[0]?.text?.content || '',
      email: p.properties.Email?.email || '',
      status: p.properties.Status?.select?.name || '',
      lastContact: p.properties['Last Contact']?.date?.start || '',
      notes: p.properties.Notes?.rich_text?.[0]?.text?.content || '',
    }));
  } catch (err) {
    console.error('[crm] getContactsNeedingFollowup error:', err.message);
    return [];
  }
}

// ── Draft follow-up email ─────────────────────────────────────────────────
const FOLLOWUP_SYSTEM = `You are writing a follow-up email for Josh Premuda, owner of Smalley Coffee in Jasper, Indiana.
Smalley Coffee is a craft roaster operating since 2014. Josh is offering wholesale accounts and private label options.
The tone is: confident, warm, not pushy. Like the Rat Pack — smooth, unhurried, sure of themselves.
Write a follow-up email based on the contact context provided.
Keep it under 150 words. Include a subject line on the first line as "Subject: ...".
Then a blank line, then the email body. Sign as Josh at Smalley Coffee.`;

async function draftFollowup(contact, emailHistory = '') {
  const context = `
Contact: ${contact.name} at ${contact.company}
Email: ${contact.email}
Status: ${contact.status}
Last contact: ${contact.lastContact}
Notes: ${contact.notes}

Previous email thread:
${emailHistory || '(no prior thread available)'}
`;
  const msg = await getAI().messages.create({
    model: process.env.SONNET_MODEL || 'claude-sonnet-4-6',
    max_tokens: 400,
    system: FOLLOWUP_SYSTEM,
    messages: [{ role: 'user', content: context }],
  });
  return msg.content[0]?.text || '(draft failed)';
}

// ── Notion: update contact last-contact date ──────────────────────────────
async function touchContact(pageId) {
  await getNotion().pages.update({
    page_id: pageId,
    properties: {
      'Last Contact': { date: { start: new Date().toISOString().split('T')[0] } },
    },
  });
}

// ── Gmail: send email ─────────────────────────────────────────────────────
async function sendEmail({ to, subject, body }) {
  if (!process.env.GOOGLE_CLIENT_ID) throw new Error('Gmail not configured');
  const token = await refreshGoogleToken();
  const raw = Buffer.from(
    `To: ${to}\r\nSubject: ${subject}\r\nContent-Type: text/plain; charset=utf-8\r\n\r\n${body}`
  ).toString('base64url');
  await axios.post(
    'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
    { raw },
    { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
  );
}

async function refreshGoogleToken() {
  const res = await axios.post('https://oauth2.googleapis.com/token', {
    client_id: process.env.GOOGLE_CLIENT_ID,
    client_secret: process.env.GOOGLE_CLIENT_SECRET,
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
    grant_type: 'refresh_token',
  });
  return res.data.access_token;
}

// ── Get pipeline overview from Notion ────────────────────────────────────
async function getPipelineOverview() {
  if (!PIPELINE_DB_ID) return '(Pipeline DB not configured)';
  try {
    const res = await getNotion().databases.query({ database_id: PIPELINE_DB_ID });
    const rows = res.results.map((p) => {
      const stage = p.properties.Stage?.select?.name || '?';
      const vol = p.properties['Est. Monthly Volume']?.number || 0;
      const notes = p.properties.Notes?.rich_text?.[0]?.text?.content || '';
      return `• ${stage} — ${vol} lbs/mo  ${notes}`;
    });
    return rows.length ? rows.join('\n') : 'Pipeline is empty';
  } catch (err) {
    return `(Pipeline error: ${err.message})`;
  }
}

module.exports = {
  isWholesaleLead,
  extractContactInfo,
  createContact,
  getContactsNeedingFollowup,
  draftFollowup,
  touchContact,
  sendEmail,
  getPipelineOverview,
  setDbIds: (contacts, pipeline) => {
    CONTACTS_DB_ID = contacts || CONTACTS_DB_ID;
    PIPELINE_DB_ID = pipeline || PIPELINE_DB_ID;
  },
};
