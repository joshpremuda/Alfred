#!/usr/bin/env bash
# run.sh — the daily Paper Filter pipeline: gather → write → render → send.
# Writing runs on your Claude subscription (free) via Claude Code headless.
#
#   ./paper-filter/run.sh              # approve mode (default): draft + review copy
#   PF_MODE=auto ./paper-filter/run.sh # fully automatic send
#
# Schedule it with: ./paper-filter/install-schedule.sh install

set -euo pipefail
cd "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Load secrets (Mailchimp keys, etc.) if present. Read KEY=VALUE lines literally
# so values with spaces don't need quoting and are never executed as commands.
if [[ -f paper-filter/.env ]]; then
  while IFS= read -r line || [[ -n "$line" ]]; do
    [[ -z "$line" || "$line" == \#* ]] && continue
    key="${line%%=*}"; val="${line#*=}"
    val="${val%\"}"; val="${val#\"}"   # strip optional surrounding quotes
    [[ "$key" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]] && export "$key=$val"
  done < paper-filter/.env
fi

echo "[paper-filter] $(date '+%Y-%m-%d %H:%M')  gathering headlines…"
node paper-filter/gather.mjs

echo "[paper-filter] writing today's issue (Claude, your subscription)…"
# Claude Code headless writes paper-filter/issue-content.json from the data.
# --permission-mode acceptEdits lets it write the file unattended.
claude -p "$(cat paper-filter/write-prompt.md)" --permission-mode acceptEdits >/dev/null

if [[ ! -f paper-filter/issue-content.json ]]; then
  echo "[paper-filter] ERROR: the write step produced no issue-content.json" >&2
  exit 1
fi

echo "[paper-filter] rendering email…"
node paper-filter/render.mjs

echo "[paper-filter] sending (mode: ${PF_MODE:-approve})…"
MODE="${PF_MODE:-approve}" node paper-filter/send.mjs

echo "[paper-filter] done."
