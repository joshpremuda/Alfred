# Alfred — Personal AI Agent

Alfred is a secured, Docker-isolated instance of [OpenClaw](https://openclaw.ai) running on your laptop as your personal agent.

## Quick Start

### 1. First-time setup (one time only)
```bash
./alfred setup
```
The wizard will ask for:
- Your **Anthropic API key** (required) — get one at https://console.anthropic.com/keys
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
| `./alfred status` | Show container status |
| `./alfred logs` | Stream live logs |
| `./alfred chat` | Open web chat in browser |
| `./alfred update` | Pull latest OpenClaw version |
| `./alfred onboard` | Re-run OpenClaw onboarding |

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

- **Docker-isolated** — Alfred runs inside a container with `no-new-privileges` and all capabilities dropped
- **Localhost-only** — ports are bound to `127.0.0.1`, not exposed to your network
- **Owner-only access** — DM pairing requires an explicit pairing code; Telegram restricted to your user ID
- **No host filesystem access** — the container cannot read your files unless you explicitly grant it
- **Secrets in `.env`** — your API key is never committed to git (`.gitignore` blocks it)

---

## Customising Alfred

Edit `config/agent.json` to change:
- Agent name and persona
- Which tools are enabled (browser, filesystem, shell)
- Which channels are active

Then restart: `./alfred restart`

---

## Updating OpenClaw

```bash
./alfred update
```

---

## Troubleshooting

**Alfred won't start**
- Run `./alfred logs` to see errors
- Make sure `.env` has a valid `ANTHROPIC_API_KEY`
- Make sure Docker is running: `docker info`

**Web chat shows "Connecting…"**
- Wait ~30 seconds for the container to install OpenClaw on first boot
- Check logs: `./alfred logs`

**Telegram not working**
- Confirm `TELEGRAM_BOT_TOKEN` is set in `.env`
- Re-run onboarding: `./alfred onboard`
