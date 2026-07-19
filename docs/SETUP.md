# Valet — Setup Guide

Everything needed to run Valet on your always-on MacBook and reach it from your
iPad and phone. Estimated time: ~15 minutes.

---

## 0. Prerequisites

- **macOS** with **Node.js 18+** (`node -v`). Install via [nodejs.org](https://nodejs.org)
  or `brew install node`.
- An **Anthropic API key** — [console.anthropic.com/keys](https://console.anthropic.com/keys).
- **Obsidian** (optional but recommended) for your knowledge vault.

> No Ollama, no Docker, no database server. Valet is a single Next.js app with a
> local SQLite file. Embeddings run in-process (Transformers.js) — the model
> downloads once on first use.

---

## Fastest path (two commands)

If you just want it running (prereq: Node 18+):

```bash
git clone -b claude/laptop-second-brain-setup-7jiuw7 https://github.com/joshpremuda/Alfred.git valet && cd valet
./scripts/bootstrap-macos.sh
```

`bootstrap-macos.sh` runs everything below for you — prereq check, `.env`, vault
detection, a hidden prompt for your API key, install, build, test, and start. It
finishes at `http://localhost:3210`. Then jump to step 7 (Import Obsidian).
The manual steps below are the same thing, broken out.

---

## 1. Prep the laptop

```bash
git clone https://github.com/joshpremuda/Alfred.git valet
cd valet
./scripts/setup-macos.sh                  # disk/clutter audit + prerequisite check
./scripts/setup-macos.sh clean            # optional: reclaim cache space
./scripts/setup-macos.sh uninstall-ollama # if Ollama is still installed
./scripts/setup-macos.sh vault            # detect your Obsidian vault → BRAIN_VAULT
```

---

## 2. Configure secrets

```bash
cp .env.example .env
```

Edit `.env`:

| Key | What |
|-----|------|
| `ANTHROPIC_API_KEY` | Your key (used for answers & briefings). **Never paste it into chat.** |
| `ANTHROPIC_MODEL` | Defaults to `claude-sonnet-5`. |
| `BRAIN_VAULT` | Your Obsidian vault path (set by `setup-macos.sh vault`). |
| `CALENDAR_ICS_URL` | *(optional)* a published iCloud/Google calendar `.ics` URL. |
| `PORT` | Defaults to `3210`. |

`.env` is gitignored — it never leaves the laptop.

---

## 3. Install & run

```bash
npm install
npm run dev        # development → http://localhost:3210
```

First message may take a few seconds while the embedding model downloads (once).

For an always-on production run, use the login service in step 5.

---

## 3b. No API credits yet? (automatic local fallback)

If your Anthropic billing isn't working, Valet still gives you a working Alfred:
skip the key at the prompt (or leave `ANTHROPIC_API_KEY` blank) and chat/briefings
run on a **free, in-process local model** (`onnx-community/Qwen2.5-0.5B-Instruct`,
downloads ~0.4 GB once on first chat). It's a capable stopgap — noticeably less
sharp than Claude, and the first reply is slow while the model downloads.

- For better local quality, set `LOCAL_MODEL=onnx-community/Qwen2.5-1.5B-Instruct`
  (or a 3B) in `.env`.
- The moment a working `ANTHROPIC_API_KEY` (with credits) is present, Valet uses
  **Claude automatically** — no code change. If a Claude call fails (e.g. no
  credits), it silently falls back to local for that reply.

## 4. Calendar (optional)

Give Alfred calendar awareness without any cloud credentials:

1. In **Calendar.app**, right-click a calendar → **Share Calendar** → enable
   **Public Calendar**, copy the URL.
2. Put it in `.env` as `CALENDAR_ICS_URL=` (change `webcal://` to `https://`).

Events then feed into **Brief me** and chat ("what's on today?").

---

## 5. Always-on autostart (launchd)

Keep Valet running across logins and crashes:

```bash
./scripts/install-launchd.sh install     # builds, installs, and starts the service
./scripts/install-launchd.sh status
./scripts/install-launchd.sh logs
./scripts/install-launchd.sh uninstall    # to remove
```

Set your Mac to never sleep on power: **System Settings → Battery → Options →
Prevent automatic sleeping when the display is off** (or Energy Saver).

---

## 6. Remote access from iPad / phone (Tailscale)

Valet binds to **localhost only** (`127.0.0.1`) — so it is never exposed on
coffee-shop wifi or your LAN. To reach it from your devices, use Tailscale's
`serve`, which proxies your tailnet (only your devices) to the local app over
HTTPS:

1. Install [Tailscale](https://tailscale.com/download) on the **Mac** and on your
   **iPad/phone**; sign in with the same account on all of them.
2. On the Mac, expose Valet to your tailnet only:
   ```bash
   tailscale serve --bg 3210
   tailscale serve status          # shows the https://<mac>.<tailnet>.ts.net URL
   ```
3. Open that `https://<mac>.<tailnet>.ts.net` URL on your iPad/phone and add it to
   your home screen. Only devices signed into your tailnet can reach it.

To stop sharing: `tailscale serve --https=443 off`.

> Because Valet listens on localhost, nothing is reachable from other networks
> even if you join an untrusted wifi — only your tailnet, via the step above.

---

## 7. Using Valet

**On first run**, open the **Vault** tab and click **Import Obsidian** to ingest
your existing notes — Alfred can then answer from your whole vault immediately.
(After the embedding model finishes downloading, click **Reindex** once to add
semantic search on top of keyword search.)

- **Chat** — ask anything. "What should I work on today?", "What's stalled?",
  "Summarize everything I know about Crema", "Build a plan for the Digital Caddie
  Book", "Draft this in my voice." Tap **🎙** for voice input.
- **Capture** — paste a URL or type a note in the capture bar. Alfred extracts,
  summarizes, files it into Collections, embeds it for search, and writes a
  Markdown note into `<vault>/Valet/Inbox/`.
- **Brief me** — an on-demand, prioritized briefing.
- **Vault** — everything you've captured, searchable.
- **Projects** — track status + next actions; Alfred flags stalled ones.
- **Ideas** — your reservoir; it never disappears, and Alfred links new material to it.
- **Notifications** — a quiet center: "Alfred has N items worth your attention."

---

## 8. Updating

```bash
git pull
npm install
./scripts/install-launchd.sh install   # rebuild + restart the service
```

---

## 9. Troubleshooting

| Symptom | Fix |
|--------|-----|
| "ANTHROPIC_API_KEY is not set" | Add your key to `.env`, restart. |
| First reply is slow | The embedding model is downloading once; subsequent runs are fast. |
| Captures save but search finds nothing | Ensure the model finished downloading (needs internet on first run). |
| iPad can't reach it | Confirm Tailscale is connected on both devices; use the MagicDNS name + `:3210`. |
| Service won't start | `./scripts/install-launchd.sh logs` to see errors. |
