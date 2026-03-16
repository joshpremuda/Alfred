# Smalley Coffee CRM Sync

Reads contacts from your **Notion database**, **Google Sheet (crm tab)**, and **Gmail**, then builds/updates a unified CRM in Notion with a **Last Contacted** date for every contact.

---

## What it does

1. **Reads Notion** — scans `https://notion.so/adf1c7f9d8134dd3945aa32ed4d25eab`
2. **Reads Google Sheets** — scans the `crm` tab of `https://docs.google.com/spreadsheets/d/1oolgnPGky69dKRrNQAyFHBpzMYCve1esjfyw6Zp3Bnw`
3. **Scans Gmail** — finds the most recent email to/from each contact
4. **Upserts Notion CRM** — creates/updates a Notion database with these columns:
   - Name, Email, Company, Phone, Role, Status, Notes, Source
   - **Last Contacted** ← date of most recent Gmail thread

---

## Setup (one time)

### Step 1 — Notion Integration Token

1. Go to https://www.notion.so/profile/integrations → **New integration**
2. Name it "Alfred CRM", select your workspace
3. Copy the **Internal Integration Token** (starts with `ntn_` or `secret_`)
4. Open **both** Notion databases (source + CRM target) → `...` menu → **Connections** → add your integration

### Step 2 — Google Cloud OAuth2 Credentials

1. Go to https://console.cloud.google.com/apis/credentials
2. Create a project (e.g. "Alfred CRM")
3. Enable these APIs:
   - Gmail API
   - Google Sheets API
4. Create credentials: **OAuth client ID** → Application type: **Desktop app**
5. Download the JSON — copy `client_id` and `client_secret` values

### Step 3 — Add to `.env`

Add these lines to `/home/user/Alfred/.env`:

```
# ── Notion ──────────────────────────────────────────────────
NOTION_TOKEN=ntn_REPLACE_ME
NOTION_CRM_DATABASE_ID=REPLACE_WITH_TARGET_CRM_DB_ID
NOTION_SOURCE_DATABASE_ID=adf1c7f9d8134dd3945aa32ed4d25eab

# ── Google ──────────────────────────────────────────────────
GOOGLE_CLIENT_ID=REPLACE_ME.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=REPLACE_ME
GOOGLE_SHEET_ID=1oolgnPGky69dKRrNQAyFHBpzMYCve1esjfyw6Zp3Bnw
GOOGLE_SHEET_TAB=crm
```

**NOTION_CRM_DATABASE_ID**: Either use your existing Notion CRM database ID, or create a new blank Notion database for Smalley Coffee CRM and paste its ID here.

To get a Notion database ID: open the database → copy the URL → the ID is the 32-char hex string between the last `/` and `?`.

### Step 4 — Authorize Google

```bash
cd integrations
npm install
node auth-setup.js
```

Follow the prompts — it opens a browser URL, you approve, paste the code back. Saves `token.json` locally (gitignored).

---

## Run

```bash
cd integrations
node crm-sync.js
```

Or via npm:
```bash
npm run sync
```

---

## Schedule (optional)

Add to crontab to sync daily at 8am:
```
0 8 * * * cd /home/user/Alfred/integrations && node crm-sync.js >> ../.logs/crm-sync.log 2>&1
```

---

## Files

| File | Purpose |
|------|---------|
| `crm-sync.js` | Main sync script |
| `auth-setup.js` | One-time Google OAuth2 setup |
| `package.json` | Node dependencies |
| `token.json` | Google OAuth token (gitignored, created by auth-setup.js) |
