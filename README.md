# Smalley VALET — Autonomous AI Staff for Smalley Coffee

An autonomous AI staff system for Josh Premuda at Smalley Coffee, Jasper Indiana.

**What it does automatically:**
- 7am — Morning briefing via Telegram (email, calendar, coffee industry news)
- 9am — Follow-up email drafts for wholesale contacts needing attention
- All day — Logs wholesale leads from Gmail into Notion CRM

**Commands you can text your bot anytime:**
- "briefing" — morning report on demand
- "follow-ups" — draft follow-up emails
- "pipeline" — see your sales pipeline
- "make a [post/image] for [subject]" — generate on-brand design
- Anything else — general assistant

---

## Quick Start

### 1. Copy and configure .env
```bash
cp .env.example .env
# Edit .env and add your API keys (see below)
```

### 2. Install dependencies
```bash
./alfred valet-setup
```

### 3. Create Notion databases (once)
```bash
node scripts/setup-notion.js
# Copy the DB IDs it prints into .env
```

### 4. Start VALET
```bash
./alfred start
```

Your bot will send a startup confirmation to Telegram.

---

## API Keys Needed

| Key | Where to get it | Required for |
|-----|-----------------|--------------|
| `ANTHROPIC_API_KEY` | [console.anthropic.com](https://console.anthropic.com/keys) | Everything |
| `TELEGRAM_BOT_TOKEN` | @BotFather on Telegram | Bot interface |
| `TELEGRAM_OWNER_ID` | @userinfobot on Telegram | Security |
| `NOTION_TOKEN` | [notion.so/my-integrations](https://www.notion.so/my-integrations) | CRM |
| `NOTION_PAGE_ID` | Page URL hex ID | CRM |
| `GOOGLE_CLIENT_ID/SECRET/REFRESH_TOKEN` | Google Cloud Console | Gmail + Calendar |
| `NEWSAPI_KEY` | [newsapi.org](https://newsapi.org) | News in briefing |
| `FAL_API_KEY` | [fal.ai/dashboard](https://fal.ai/dashboard) | Design agent |

---

## Server Deployment (Oracle Cloud)

To deploy on an Oracle Cloud Ubuntu server:

```bash
# On the server as root:
git clone https://github.com/joshpremuda/Alfred /tmp/Alfred
cp -r /tmp/Alfred /opt/valet
cd /opt/valet
cp .env.example .env
# Edit .env with your API keys
bash scripts/server-setup.sh
```

The setup script:
1. Installs Docker, Node.js 20, Nginx, Certbot
2. Starts n8n at your domain with SSL
3. Installs the VALET bot as a systemd service
4. Configures firewall and maintenance crons

### n8n Workflows

Import the pre-built workflow files from `n8n/workflows/` into n8n:
1. Open n8n at your domain
2. Go to Workflows → Import
3. Import each JSON file

---

## All Commands

| Command | What it does |
|---------|-------------|
| `./alfred valet-setup` | Install VALET npm dependencies |
| `./alfred start` | Start web chat + VALET bot |
| `./alfred stop` | Stop all services |
| `./alfred restart` | Restart |
| `./alfred status` | Show service status + PIDs |
| `./alfred logs` | Tail live logs |
| `./alfred setup` | First-time setup for local Ollama mode |
| `./alfred chat` | Open local web chat in browser |

---

## Architecture

```
Josh's phone
    │ Telegram
    ▼
VALET Bot (telegram/valet.js)
    │
    ├─ Haiku intent router (agents/intent.js)
    │       ├─ BRIEFING → agents/briefing.js
    │       │       ├─ Gmail API (unread emails)
    │       │       ├─ Google Calendar API
    │       │       ├─ RSS feeds (Sprudge, DCN, custom)
    │       │       └─ NewsAPI
    │       ├─ CRM → agents/crm.js
    │       │       ├─ Notion API (contacts + pipeline)
    │       │       ├─ Gmail API (send email)
    │       │       └─ Sonnet (draft emails)
    │       ├─ DESIGN → agents/design.js
    │       │       ├─ Sonnet (build FLUX prompt)
    │       │       └─ Fal.ai FLUX (generate image)
    │       └─ UNKNOWN → Sonnet (general assistant)
    │
    └─ Scheduled jobs
            ├─ 7:00am CT — Daily briefing
            └─ 9:00am CT — Follow-up drafts
```

---

## Monthly Cost

| Service | Cost |
|---------|------|
| Oracle Cloud (4 vCPU, 24GB) | $0 — Always Free |
| Anthropic API (Haiku + Sonnet) | ~$5–8 |
| Fal.ai FLUX (design) | ~$1 |
| Everything else | $0 |
| **Total** | **~$6–9/mo** |

---

## Maintenance

- **Update VALET:** SSH in and run `bash /opt/valet/scripts/update.sh`
- **Check health:** `bash /opt/valet/scripts/health-check.sh`
- **View bot logs:** `tail -f /opt/valet/logs/valet-bot.log`
- **Backup:** Runs automatically every Sunday at 2am

---

## Security

- Telegram bot restricted to `TELEGRAM_OWNER_ID` only
- All API keys stored in `.env` (never committed — in `.gitignore`)
- n8n behind Nginx with basic auth + HTTPS
- Firewall: only ports 22, 80, 443 open
- Email send and external posts require explicit Telegram approval
