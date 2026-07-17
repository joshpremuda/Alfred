#!/usr/bin/env bash
# bootstrap-macos.sh — one command to get Valet running on a fresh Mac.
#
# Does everything except create your Anthropic API key (only you can do that):
#   prereq check → .env → detect Obsidian vault → paste key at a prompt →
#   install → build → test → start.
#
# Usage:
#   ./scripts/bootstrap-macos.sh

set -euo pipefail

cd "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

BOLD=$'\033[1m'; GREEN=$'\033[0;32m'; YELLOW=$'\033[1;33m'; RED=$'\033[0;31m'; RESET=$'\033[0m'
step() { printf '\n%s▸ %s%s\n' "$BOLD" "$*" "$RESET"; }
ok()   { printf '  %s✓%s %s\n' "$GREEN" "$RESET" "$*"; }
warn() { printf '  %s!%s %s\n' "$YELLOW" "$RESET" "$*"; }
die()  { printf '  %s✗%s %s\n' "$RED" "$RESET" "$*" >&2; exit 1; }
sedi() { sed -i '' "$@" 2>/dev/null || sed -i "$@"; }

step "1/6  Prerequisites"
command -v node >/dev/null 2>&1 || die "Node.js not found. Install Node 18+ (https://nodejs.org or 'brew install node'), then re-run."
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
(( NODE_MAJOR >= 18 )) || die "Node $(node --version) is too old — need v18+."
ok "Node $(node --version)"

step "2/6  Config (.env)"
[[ -f .env ]] || { cp .env.example .env; ok "Created .env from template"; }

step "3/6  Obsidian vault"
if grep -qE '^BRAIN_VAULT=.+' .env; then
  ok "BRAIN_VAULT already set ($(grep '^BRAIN_VAULT=' .env | cut -d= -f2-))"
else
  ./scripts/setup-macos.sh vault || warn "Vault detection skipped — you can set BRAIN_VAULT in .env later."
fi

step "4/6  Anthropic API key"
if grep -qE '^ANTHROPIC_API_KEY=sk-' .env && ! grep -qE 'REPLACE' .env; then
  ok "API key already present in .env"
else
  echo "  Create a key at https://console.anthropic.com/keys (rotate the old one if it leaked)."
  printf '  Paste your Anthropic API key (hidden), or press Enter to skip: '
  read -rs KEY || true
  echo
  if [[ -n "${KEY:-}" ]]; then
    # Escape characters that are special to sed's replacement.
    ESC=$(printf '%s' "$KEY" | sed -e 's/[&|\\]/\\&/g')
    sedi "s|^ANTHROPIC_API_KEY=.*|ANTHROPIC_API_KEY=$ESC|" .env
    ok "Saved key to .env (gitignored — never committed)"
  else
    warn "No key entered. Chat/briefings won't work until you add ANTHROPIC_API_KEY to .env; capture & keyword search still work."
  fi
fi

step "5/6  Install, build, test"
npm install --no-fund --no-audit
ok "Dependencies installed"
npm run build
ok "Build passed"
npm test || warn "Some tests failed — continuing; review with 'npm test'."

step "6/6  Start"
# Free the port if a stale server is holding it.
if command -v lsof >/dev/null 2>&1; then
  PIDS="$(lsof -ti tcp:3210 2>/dev/null || true)"
  [[ -n "$PIDS" ]] && { echo "$PIDS" | xargs kill -9 2>/dev/null || true; warn "Freed port 3210 from a stale server."; }
fi

cat <<'NEXT'

  ─────────────────────────────────────────────────────────────
  Valet is starting at  http://localhost:3210
  Once it loads, in the browser:
    1. Vault tab → "Import Obsidian"   (ingest your existing notes)
    2. After the first chat (model downloads once) → click "Reindex"
    3. Try:  "Brief me"   or   "What should I work on today?"

  Later, for always-on + phone access:
    ./scripts/install-launchd.sh install
    tailscale serve --bg 3210
  ─────────────────────────────────────────────────────────────

NEXT

exec npm run dev
