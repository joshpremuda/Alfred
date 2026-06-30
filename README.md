# Alfred — Personal AI Agent

Alfred is a personal AI agent powered by Claude (Anthropic), accessible via web browser and Telegram.

## Quick Start

### 1. First-time setup
```bash
./alfred setup
```
The wizard will ask for:
- Your **Anthropic API key** (required) — get one at https://console.anthropic.com/keys
- Your preferred **Claude model** (default: `claude-sonnet-4-6`)
- Your **Telegram bot token** (optional but recommended for mobile access)

### 2. Start Alfred
```bash
./alfred start
```

### 3. Talk to Alfred
| Interface | How |
|-----------|-----|
| **Web browser** | Open http://localhost:3000 |
| **Telegram** | Message your bot directly |

---

## All Commands

| Command | What it does |
|---------|-------------|
| `./alfred setup` | First-time setup wizard |
| `./alfred start` | Start Alfred |
| `./alfred stop` | Stop Alfred |
| `./alfred restart` | Restart Alfred |
| `./alfred status` | Show service status |
| `./alfred logs` | Stream live logs |
| `./alfred chat` | Open web chat in browser |

---

## Auto-start on Login (optional)

### systemd (Linux)
```bash
sudo cp alfred.service /etc/systemd/system/
sudo systemctl enable alfred
sudo systemctl start alfred
```

---

## Security Model

- **Localhost-only** — ports are bound to `127.0.0.1`, not exposed to your network
- **Telegram owner-only** — restricted to your user ID
- **Secrets in `.env`** — your API key is never committed to git (`.gitignore` blocks it)

---

## Customising Alfred

Edit `config/agent.json` to change the agent name, persona, and which tools/channels are active.

Then restart: `./alfred restart`

---

## Troubleshooting

**Alfred won't start**
- Run `./alfred logs` to see errors
- Make sure `.env` has a valid `ANTHROPIC_API_KEY`

**Web chat shows "Connecting…"**
- Check logs: `./alfred logs`

**Telegram not working**
- Confirm `TELEGRAM_BOT_TOKEN` is set in `.env`
