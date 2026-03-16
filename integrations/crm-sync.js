#!/usr/bin/env node
/**
 * crm-sync.js — Smalley Coffee CRM Sync
 *
 * Reads:
 *   1. Existing Notion CRM database (NOTION_CRM_DATABASE_ID)
 *   2. Google Sheet "crm" tab (GOOGLE_SHEET_ID)
 *   3. Gmail — searches for emails to/from each contact
 *
 * Writes:
 *   → Upserts contacts into Notion with a "Last Contacted" date property
 *
 * Run: node crm-sync.js
 */

require('dotenv').config({ path: '../.env' });
const { Client } = require('@notionhq/client');
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

// ─── Config ────────────────────────────────────────────────────────────────

const NOTION_TOKEN          = process.env.NOTION_TOKEN;
const NOTION_CRM_DB_ID      = process.env.NOTION_CRM_DATABASE_ID;
const GOOGLE_SHEET_ID       = process.env.GOOGLE_SHEET_ID        || '1oolgnPGky69dKRrNQAyFHBpzMYCve1esjfyw6Zp3Bnw';
const GOOGLE_SHEET_TAB      = process.env.GOOGLE_SHEET_TAB       || 'crm';
const TOKEN_PATH            = path.join(__dirname, 'token.json');
// Notion source database (the one from the link shared)
const NOTION_SOURCE_DB_ID   = process.env.NOTION_SOURCE_DATABASE_ID || 'adf1c7f9d8134dd3945aa32ed4d25eab';

// ─── Helpers ───────────────────────────────────────────────────────────────

function validateEnv() {
  const missing = [];
  if (!NOTION_TOKEN)     missing.push('NOTION_TOKEN');
  if (!NOTION_CRM_DB_ID) missing.push('NOTION_CRM_DATABASE_ID');
  if (!process.env.GOOGLE_CLIENT_ID)     missing.push('GOOGLE_CLIENT_ID');
  if (!process.env.GOOGLE_CLIENT_SECRET) missing.push('GOOGLE_CLIENT_SECRET');
  if (!fs.existsSync(TOKEN_PATH)) missing.push('token.json (run: node auth-setup.js)');

  if (missing.length > 0) {
    console.error('\nMissing required configuration:');
    missing.forEach(m => console.error(`  ✗ ${m}`));
    console.error('\nSee integrations/README.md for setup instructions.\n');
    process.exit(1);
  }
}

function getGoogleAuth() {
  const oAuth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    'urn:ietf:wg:oauth:2.0:oob'
  );
  const token = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'));
  oAuth2Client.setCredentials(token);
  return oAuth2Client;
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// ─── 1. Read Notion Source Database ────────────────────────────────────────

async function readNotionSourceDB(notion) {
  console.log('\n[1/4] Reading Notion source database…');
  const contacts = [];

  try {
    let cursor;
    do {
      const resp = await notion.databases.query({
        database_id: NOTION_SOURCE_DB_ID,
        start_cursor: cursor,
        page_size: 100,
      });

      for (const page of resp.results) {
        const props = page.properties;
        const contact = extractNotionContact(page.id, props);
        if (contact.name) contacts.push(contact);
      }

      cursor = resp.next_cursor;
    } while (cursor);

    console.log(`  Found ${contacts.length} contacts in Notion source DB`);
  } catch (err) {
    if (err.code === 'object_not_found' || err.status === 404) {
      console.warn('  ⚠ Notion source database not found or not shared with integration');
      console.warn('  Share the database with your Notion integration and try again');
    } else {
      console.warn('  ⚠ Could not read Notion source DB:', err.message);
    }
  }

  return contacts;
}

function extractNotionContact(pageId, props) {
  const contact = { pageId, source: 'notion' };

  // Try common property name patterns
  for (const [key, val] of Object.entries(props)) {
    const k = key.toLowerCase();

    if (!contact.name && (k === 'name' || k === 'contact name' || k === 'full name' || k === 'title')) {
      contact.name = getNotionTextValue(val);
    }
    if (!contact.email && (k === 'email' || k === 'email address' || k.includes('email'))) {
      contact.email = getNotionTextValue(val) || getNotionEmailValue(val);
    }
    if (!contact.company && (k === 'company' || k === 'organization' || k === 'account')) {
      contact.company = getNotionTextValue(val);
    }
    if (!contact.phone && (k === 'phone' || k === 'phone number' || k === 'mobile')) {
      contact.phone = getNotionTextValue(val) || getNotionPhoneValue(val);
    }
    if (!contact.role && (k === 'role' || k === 'title' || k === 'position' || k === 'job title')) {
      if (key.toLowerCase() !== 'name') contact.role = getNotionTextValue(val);
    }
    if (!contact.notes && (k === 'notes' || k === 'note' || k === 'description')) {
      contact.notes = getNotionTextValue(val);
    }
    if (!contact.status && (k === 'status' || k === 'stage' || k === 'deal stage')) {
      contact.status = getNotionSelectValue(val) || getNotionTextValue(val);
    }
  }

  return contact;
}

function getNotionTextValue(prop) {
  if (!prop) return '';
  if (prop.type === 'title') return prop.title?.map(t => t.plain_text).join('') || '';
  if (prop.type === 'rich_text') return prop.rich_text?.map(t => t.plain_text).join('') || '';
  if (prop.type === 'email') return prop.email || '';
  if (prop.type === 'phone_number') return prop.phone_number || '';
  if (prop.type === 'url') return prop.url || '';
  return '';
}

function getNotionEmailValue(prop) {
  return prop?.type === 'email' ? (prop.email || '') : '';
}

function getNotionPhoneValue(prop) {
  return prop?.type === 'phone_number' ? (prop.phone_number || '') : '';
}

function getNotionSelectValue(prop) {
  if (!prop) return '';
  if (prop.type === 'select') return prop.select?.name || '';
  if (prop.type === 'multi_select') return prop.multi_select?.map(s => s.name).join(', ') || '';
  if (prop.type === 'status') return prop.status?.name || '';
  return '';
}

// ─── 2. Read Google Sheet CRM Tab ──────────────────────────────────────────

async function readGoogleSheetCRM(auth) {
  console.log('\n[2/4] Reading Google Sheet "crm" tab…');
  const sheets = google.sheets({ version: 'v4', auth });

  const resp = await sheets.spreadsheets.values.get({
    spreadsheetId: GOOGLE_SHEET_ID,
    range: `${GOOGLE_SHEET_TAB}!A1:Z1000`,
  });

  const rows = resp.data.values || [];
  if (rows.length < 2) {
    console.log('  No data found in sheet');
    return [];
  }

  const headers = rows[0].map(h => h.trim().toLowerCase());
  const contacts = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.every(cell => !cell?.trim())) continue;

    const contact = { source: 'sheets', rowIndex: i + 1 };

    headers.forEach((h, idx) => {
      const val = (row[idx] || '').trim();
      if (!val) return;

      if (h.includes('name') && !h.includes('company') && !h.includes('org')) contact.name = val;
      else if (h.includes('email')) contact.email = val;
      else if (h.includes('company') || h.includes('organization') || h.includes('account')) contact.company = val;
      else if (h.includes('phone') || h.includes('mobile')) contact.phone = val;
      else if (h.includes('role') || h.includes('title') || h.includes('position')) contact.role = val;
      else if (h.includes('status') || h.includes('stage')) contact.status = val;
      else if (h.includes('note') || h.includes('description')) contact.notes = val;
      else if (h.includes('last contact') || h.includes('last email') || h === 'contacted') {
        contact.sheetLastContacted = val;
      }
    });

    if (contact.name || contact.email) contacts.push(contact);
  }

  console.log(`  Found ${contacts.length} contacts in Google Sheet`);
  return contacts;
}

// ─── 3. Find Last Contact Date via Gmail ───────────────────────────────────

async function getLastContactedFromGmail(auth, contacts) {
  console.log('\n[3/4] Searching Gmail for last contact dates…');
  const gmail = google.gmail({ version: 'v1', auth });

  let found = 0;
  for (const contact of contacts) {
    if (!contact.email) continue;

    try {
      // Search sent + received emails with this contact
      const query = `from:${contact.email} OR to:${contact.email}`;
      const resp = await gmail.users.messages.list({
        userId: 'me',
        q: query,
        maxResults: 1,
        // most recent first (default)
      });

      if (resp.data.messages && resp.data.messages.length > 0) {
        const msgId = resp.data.messages[0].id;
        const msg = await gmail.users.messages.get({
          userId: 'me',
          id: msgId,
          format: 'metadata',
          metadataHeaders: ['Date', 'Subject', 'From', 'To'],
        });

        const dateHeader = msg.data.payload?.headers?.find(h => h.name === 'Date');
        if (dateHeader) {
          const date = new Date(dateHeader.value);
          if (!isNaN(date.getTime())) {
            contact.lastContacted = date.toISOString().split('T')[0]; // YYYY-MM-DD
            found++;
          }
        }
      }

      // Rate-limit: Gmail allows ~10 req/s
      await sleep(120);
    } catch (err) {
      console.warn(`  ⚠ Gmail error for ${contact.email}: ${err.message}`);
    }
  }

  console.log(`  Found last contact dates for ${found} contacts`);
  return contacts;
}

// ─── 4. Merge Contacts ─────────────────────────────────────────────────────

function mergeContacts(notionContacts, sheetContacts) {
  const merged = new Map(); // key: normalized email or name

  const key = c => (c.email || '').toLowerCase().trim() || (c.name || '').toLowerCase().trim();

  for (const c of notionContacts) {
    const k = key(c);
    if (k) merged.set(k, { ...c });
  }

  for (const c of sheetContacts) {
    const k = key(c);
    if (!k) continue;
    if (merged.has(k)) {
      // Merge: sheet data fills gaps
      const existing = merged.get(k);
      merged.set(k, {
        ...existing,
        company:  existing.company  || c.company,
        phone:    existing.phone    || c.phone,
        role:     existing.role     || c.role,
        status:   existing.status   || c.status,
        notes:    existing.notes    || c.notes,
        sheetLastContacted: c.sheetLastContacted || existing.sheetLastContacted,
      });
    } else {
      merged.set(k, { ...c });
    }
  }

  return Array.from(merged.values());
}

// ─── 5. Upsert into Notion CRM Database ────────────────────────────────────

async function ensureNotionCRMDatabase(notion) {
  console.log('\n[4/4] Syncing to Notion CRM database…');

  // First, check if DB exists
  try {
    const db = await notion.databases.retrieve({ database_id: NOTION_CRM_DB_ID });
    console.log(`  Using existing Notion CRM database: "${db.title?.[0]?.plain_text || NOTION_CRM_DB_ID}"`);
    await ensureDatabaseProperties(notion, db);
    return NOTION_CRM_DB_ID;
  } catch (err) {
    console.error('  Could not access Notion CRM database:', err.message);
    console.error(`  Make sure NOTION_CRM_DATABASE_ID is correct and the integration has access.`);
    throw err;
  }
}

async function ensureDatabaseProperties(notion, db) {
  const existing = Object.keys(db.properties || {}).map(k => k.toLowerCase());
  const required = {
    'Last Contacted': { date: {} },
    'Email':          { email: {} },
    'Company':        { rich_text: {} },
    'Phone':          { phone_number: {} },
    'Role':           { rich_text: {} },
    'Status':         {
      select: {
        options: [
          { name: 'Lead',        color: 'yellow'  },
          { name: 'Active',      color: 'green'   },
          { name: 'Follow Up',   color: 'orange'  },
          { name: 'Closed Won',  color: 'blue'    },
          { name: 'Closed Lost', color: 'red'     },
          { name: 'Partner',     color: 'purple'  },
        ]
      }
    },
    'Source':         { select: { options: [
      { name: 'Notion',  color: 'default' },
      { name: 'Sheets',  color: 'green'   },
      { name: 'Gmail',   color: 'red'     },
    ]}},
    'Notes':          { rich_text: {} },
  };

  const toAdd = {};
  for (const [name, schema] of Object.entries(required)) {
    if (!existing.includes(name.toLowerCase())) {
      toAdd[name] = schema;
    }
  }

  if (Object.keys(toAdd).length > 0) {
    console.log(`  Adding missing properties: ${Object.keys(toAdd).join(', ')}`);
    await notion.databases.update({
      database_id: NOTION_CRM_DB_ID,
      properties: toAdd,
    });
  }
}

async function upsertContact(notion, contact) {
  // Search for existing page by email or name
  const filter = contact.email
    ? { property: 'Email', email: { equals: contact.email } }
    : { property: 'Name', title: { equals: contact.name } };

  // Note: filter by email only works if "Email" is an email-type property
  let existingPageId = null;
  try {
    const results = await notion.databases.query({
      database_id: NOTION_CRM_DB_ID,
      filter,
      page_size: 1,
    });
    if (results.results.length > 0) {
      existingPageId = results.results[0].id;
    }
  } catch {
    // Filter might not work if property doesn't exist yet; skip lookup
  }

  // Determine last contacted: prefer Gmail, fallback to sheet value
  const lastContacted = contact.lastContacted || contact.sheetLastContacted || null;

  const properties = {
    'Name': {
      title: [{ text: { content: contact.name || contact.email || 'Unknown' } }]
    },
  };

  if (contact.email)   properties['Email']   = { email: contact.email };
  if (contact.company) properties['Company'] = { rich_text: [{ text: { content: contact.company } }] };
  if (contact.phone)   properties['Phone']   = { phone_number: contact.phone };
  if (contact.role)    properties['Role']    = { rich_text: [{ text: { content: contact.role } }] };
  if (contact.notes)   properties['Notes']   = { rich_text: [{ text: { content: (contact.notes || '').slice(0, 2000) } }] };
  if (contact.status)  properties['Status']  = { select: { name: contact.status } };
  if (contact.source)  properties['Source']  = { select: { name: contact.source === 'notion' ? 'Notion' : 'Sheets' } };

  if (lastContacted) {
    // Ensure it's a valid date string (YYYY-MM-DD)
    const d = new Date(lastContacted);
    if (!isNaN(d.getTime())) {
      properties['Last Contacted'] = { date: { start: d.toISOString().split('T')[0] } };
    }
  }

  if (existingPageId) {
    await notion.pages.update({ page_id: existingPageId, properties });
    return 'updated';
  } else {
    await notion.pages.create({
      parent: { database_id: NOTION_CRM_DB_ID },
      properties,
    });
    return 'created';
  }
}

// ─── Main ──────────────────────────────────────────────────────────────────

async function main() {
  console.log('╔════════════════════════════════════════╗');
  console.log('║  Smalley Coffee CRM Sync               ║');
  console.log('╚════════════════════════════════════════╝');

  validateEnv();

  const notion = new Client({ auth: NOTION_TOKEN });
  const auth   = getGoogleAuth();

  // 1. Read sources
  const notionContacts = await readNotionSourceDB(notion);
  const sheetContacts  = await readGoogleSheetCRM(auth);

  // 2. Merge
  const merged = mergeContacts(notionContacts, sheetContacts);
  console.log(`\n  Merged total: ${merged.length} unique contacts`);

  // 3. Enrich with Gmail last-contacted dates
  await getLastContactedFromGmail(auth, merged);

  // 4. Sync to Notion CRM
  await ensureNotionCRMDatabase(notion);

  let created = 0, updated = 0, errors = 0;

  for (const contact of merged) {
    try {
      const result = await upsertContact(notion, contact);
      if (result === 'created') created++;
      else updated++;
      process.stdout.write(`\r  Progress: ${created + updated + errors}/${merged.length} (${created} new, ${updated} updated, ${errors} errors)`);
      await sleep(350); // Notion rate limit: ~3 req/s
    } catch (err) {
      errors++;
      console.warn(`\n  ⚠ Failed to sync "${contact.name || contact.email}": ${err.message}`);
    }
  }

  console.log('\n\n╔════════════════════════════════════════╗');
  console.log(`║  Done! Created: ${String(created).padEnd(4)} Updated: ${String(updated).padEnd(4)} Errors: ${String(errors).padEnd(3)} ║`);
  console.log('╚════════════════════════════════════════╝\n');
}

main().catch(err => {
  console.error('\nFatal error:', err.message);
  process.exit(1);
});
