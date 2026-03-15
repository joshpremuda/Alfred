'use strict';
// Smalley VALET — Notion Database Setup
// Run once: node scripts/setup-notion.js
// Creates the Contacts and Pipeline databases in your Notion workspace.

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { Client } = require('@notionhq/client');

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const PAGE_ID = process.env.NOTION_PAGE_ID;

if (!process.env.NOTION_TOKEN || !PAGE_ID) {
  console.error('Error: NOTION_TOKEN and NOTION_PAGE_ID must be set in .env');
  process.exit(1);
}

async function createContactsDB() {
  console.log('Creating Contacts database…');
  const db = await notion.databases.create({
    parent: { type: 'page_id', page_id: PAGE_ID },
    title: [{ type: 'text', text: { content: 'VALET — Contacts' } }],
    icon: { type: 'emoji', emoji: '📇' },
    properties: {
      Name:           { title: {} },
      Company:        { rich_text: {} },
      Email:          { email: {} },
      Phone:          { phone_number: {} },
      Source:         { select: { options: [
        { name: 'email',          color: 'blue'   },
        { name: 'referral',       color: 'green'  },
        { name: 'cold outreach',  color: 'orange' },
        { name: 'event',          color: 'purple' },
      ]}},
      Status:         { select: { options: [
        { name: 'prospect',    color: 'gray'   },
        { name: 'sampled',     color: 'yellow' },
        { name: 'negotiating', color: 'orange' },
        { name: 'active',      color: 'green'  },
        { name: 'inactive',    color: 'red'    },
      ]}},
      'Last Contact': { date: {} },
      Notes:          { rich_text: {} },
      'Next Action':  { rich_text: {} },
    },
  });
  console.log('✅ Contacts DB created:', db.id);
  return db.id;
}

async function createPipelineDB(contactsDbId) {
  console.log('Creating Pipeline database…');
  const db = await notion.databases.create({
    parent: { type: 'page_id', page_id: PAGE_ID },
    title: [{ type: 'text', text: { content: 'VALET — Pipeline' } }],
    icon: { type: 'emoji', emoji: '📊' },
    properties: {
      Contact:              { title: {} },
      Stage:                { select: { options: [
        { name: 'prospect',       color: 'gray'   },
        { name: 'sampled',        color: 'yellow' },
        { name: 'proposal sent',  color: 'orange' },
        { name: 'negotiating',    color: 'blue'   },
        { name: 'closed won',     color: 'green'  },
        { name: 'closed lost',    color: 'red'    },
      ]}},
      'Est. Monthly Volume': { number: { format: 'number' } },
      Notes:                 { rich_text: {} },
      'Last Updated':        { date: {} },
    },
  });
  console.log('✅ Pipeline DB created:', db.id);
  return db.id;
}

async function main() {
  try {
    const contactsId = await createContactsDB();
    const pipelineId = await createPipelineDB(contactsId);

    console.log('\n─────────────────────────────────────────');
    console.log('Add these to your .env file:\n');
    console.log(`NOTION_CONTACTS_DB_ID=${contactsId}`);
    console.log(`NOTION_PIPELINE_DB_ID=${pipelineId}`);
    console.log('─────────────────────────────────────────\n');
    console.log('Then restart VALET: systemctl restart valet-bot');
  } catch (err) {
    console.error('Setup failed:', err.message);
    if (err.code === 'object_not_found') {
      console.error('\nMake sure your Notion integration has access to the page.');
      console.error('Go to the page in Notion → ··· menu → Add connections → your integration.');
    }
    process.exit(1);
  }
}

main();
