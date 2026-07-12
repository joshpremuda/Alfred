#!/usr/bin/env bash
# setup-macos.sh — Phase 0 laptop prep for Valet.
#
# Prepares the always-on MacBook: audits disk clutter, (optionally) cleans safe
# caches, verifies prerequisites, pulls the local embedding model, finds the
# Obsidian vault, and checks the Anthropic key.
#
# SAFETY: this touches your real machine. It is REPORT-ONLY by default and never
# deletes anything unless you run `clean` AND confirm each step interactively.
#
# Usage:
#   ./scripts/setup-macos.sh            full read-only report (audit + prereqs)
#   ./scripts/setup-macos.sh audit      disk & clutter report only
#   ./scripts/setup-macos.sh clean      interactive safe cleanup (asks per step)
#   ./scripts/setup-macos.sh prereqs    check/install Node, Ollama, embed model
#   ./scripts/setup-macos.sh vault      detect Obsidian vaults → BRAIN_VAULT
#   ./scripts/setup-macos.sh doctor     one-line readiness summary

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$ROOT_DIR/.env"

BOLD=$'\033[1m'; DIM=$'\033[2m'; RESET=$'\033[0m'
RED=$'\033[0;31m'; GREEN=$'\033[0;32m'; YELLOW=$'\033[1;33m'; BLUE=$'\033[0;34m'

say()  { printf '%s\n' "$*"; }
head() { printf '\n%s%s%s\n' "$BOLD" "$*" "$RESET"; }
ok()   { printf '  %s✓%s %s\n' "$GREEN" "$RESET" "$*"; }
no()   { printf '  %s✗%s %s\n' "$RED" "$RESET" "$*"; }
warn() { printf '  %s!%s %s\n' "$YELLOW" "$RESET" "$*"; }
info() { printf '  %s·%s %s\n' "$BLUE" "$RESET" "$*"; }

require_macos() {
  if [[ "$(uname -s)" != "Darwin" ]]; then
    no "This script is for macOS. Detected: $(uname -s)."
    exit 1
  fi
}

confirm() {
  # confirm "message" -> returns 0 if user types y/Y
  local reply
  printf '%s%s%s [y/N] ' "$YELLOW" "$1" "$RESET"
  read -r reply || true
  [[ "$reply" =~ ^[Yy]$ ]]
}

human_size() { du -sh "$1" 2>/dev/null | awk '{print $1}'; }

# ─────────────────────────────────────────────────────────────────────────────
# AUDIT (read-only)
# ─────────────────────────────────────────────────────────────────────────────
cmd_audit() {
  head "Disk overview"
  df -h / | awk 'NR==1 || /\/$/'

  head "Largest items in your home folder (top 15)"
  info "Read-only — nothing is deleted."
  du -sh "$HOME"/* "$HOME"/.[!.]* 2>/dev/null | sort -rh | head -15 || true

  head "Reclaimable caches (sizes only)"
  local targets=(
    "$HOME/Library/Caches"
    "$HOME/Library/Developer/Xcode/DerivedData"
    "$HOME/Library/Developer/CoreSimulator/Caches"
    "$HOME/Library/Logs"
    "$HOME/.npm/_cacache"
    "$HOME/Library/Caches/Homebrew"
    "$HOME/Library/Caches/pip"
    "$HOME/.cache"
  )
  local t
  for t in "${targets[@]}"; do
    [[ -e "$t" ]] && printf '  %-52s %s\n' "${t/#$HOME/~}" "$(human_size "$t")"
  done

  head "Heavy dev clutter (report only — never auto-deleted)"
  info "Stale node_modules under ~/ (older than 30 days), top 10 by size:"
  find "$HOME" -maxdepth 6 -type d -name node_modules -mtime +30 2>/dev/null \
    | while read -r d; do printf '%s\t%s\n' "$(human_size "$d")" "${d/#$HOME/~}"; done \
    | sort -rh | head -10 || true

  head "Trash"
  [[ -d "$HOME/.Trash" ]] && info "~/.Trash is $(human_size "$HOME/.Trash")"

  say ""
  info "To free space interactively, run: ./scripts/setup-macos.sh clean"
}

# ─────────────────────────────────────────────────────────────────────────────
# CLEAN (interactive, destructive — asks before each step)
# ─────────────────────────────────────────────────────────────────────────────
clean_dir_contents() {
  # empties a directory's contents (not the dir itself) after confirmation
  local dir="$1" label="$2"
  [[ -d "$dir" ]] || { info "$label — not present, skipping"; return; }
  local size; size="$(human_size "$dir")"
  if confirm "Delete contents of $label ($size)? — ${dir/#$HOME/~}"; then
    # only operate well inside $HOME as a guard
    case "$dir" in
      "$HOME"/*) rm -rf "${dir:?}/"* "${dir:?}/".[!.]* 2>/dev/null || true; ok "Cleared $label" ;;
      *) no "Refusing to touch $dir (outside home)";;
    esac
  else
    info "Skipped $label"
  fi
}

cmd_clean() {
  head "Interactive cleanup"
  warn "Each step asks before deleting. Nothing is removed without a 'y'."

  clean_dir_contents "$HOME/Library/Caches"                               "user caches"
  clean_dir_contents "$HOME/Library/Developer/Xcode/DerivedData"          "Xcode DerivedData"
  clean_dir_contents "$HOME/Library/Developer/CoreSimulator/Caches"       "iOS Simulator caches"
  clean_dir_contents "$HOME/Library/Logs"                                 "user logs"

  if command -v npm >/dev/null 2>&1; then
    if confirm "Run 'npm cache clean --force'?"; then npm cache clean --force >/dev/null 2>&1 && ok "npm cache cleaned"; fi
  fi
  if command -v brew >/dev/null 2>&1; then
    if confirm "Run 'brew cleanup -s' (old versions & caches)?"; then brew cleanup -s >/dev/null 2>&1 && ok "Homebrew cleaned"; fi
  fi

  if [[ -d "$HOME/.Trash" ]] && confirm "Empty the Trash ($(human_size "$HOME/.Trash"))?"; then
    rm -rf "$HOME/.Trash/"* "$HOME/.Trash/".[!.]* 2>/dev/null || true; ok "Trash emptied"
  fi

  say ""; ok "Cleanup pass complete."
  info "Stale node_modules are reported but never auto-deleted — remove them yourself if desired."
}

# ─────────────────────────────────────────────────────────────────────────────
# PREREQS
# ─────────────────────────────────────────────────────────────────────────────
cmd_prereqs() {
  head "Prerequisites"

  if xcode-select -p >/dev/null 2>&1; then ok "Xcode Command Line Tools"
  else no "Xcode CLT missing — install: xcode-select --install"; fi

  if command -v brew >/dev/null 2>&1; then ok "Homebrew ($(brew --version | head -1))"
  else warn "Homebrew missing — https://brew.sh (recommended for installs)"; fi

  if command -v node >/dev/null 2>&1; then
    local major; major="$(node -p 'process.versions.node.split(".")[0]')"
    if (( major >= 18 )); then ok "Node $(node --version)"
    else no "Node $(node --version) too old — need v18+ (brew install node)"; fi
  else no "Node.js missing — brew install node (v18+)"; fi

  if command -v ollama >/dev/null 2>&1; then
    ok "Ollama installed"
    if curl -sf --max-time 3 http://localhost:11434/api/tags >/dev/null 2>&1; then
      ok "Ollama is running"
      if ollama list 2>/dev/null | grep -q 'nomic-embed-text'; then
        ok "Embedding model 'nomic-embed-text' present"
      else
        warn "Embedding model missing — pulling nomic-embed-text…"
        ollama pull nomic-embed-text && ok "Pulled nomic-embed-text"
      fi
    else
      warn "Ollama not running — start it: 'ollama serve' or open the Ollama app"
    fi
  else
    no "Ollama missing — https://ollama.com/download (needed for local embeddings)"
  fi

  head "Secrets"
  if [[ -f "$ENV_FILE" ]]; then
    if grep -qE '^ANTHROPIC_API_KEY=.+' "$ENV_FILE" && ! grep -qE '^ANTHROPIC_API_KEY=.*REPLACE' "$ENV_FILE"; then
      ok "ANTHROPIC_API_KEY is set in .env"
    else
      no "ANTHROPIC_API_KEY not set in .env — add your (rotated) key"
    fi
  else
    warn ".env not found — create it: cp .env.example .env  (then add your key)"
  fi
}

# ─────────────────────────────────────────────────────────────────────────────
# VAULT
# ─────────────────────────────────────────────────────────────────────────────
cmd_vault() {
  head "Obsidian vault detection"
  info "Searching for '.obsidian' folders under ~ (this can take a moment)…"
  local found=()
  while IFS= read -r d; do found+=("$(dirname "$d")"); done < <(
    find "$HOME" -maxdepth 6 -type d -name '.obsidian' \
      -not -path '*/Library/*' -not -path '*/node_modules/*' 2>/dev/null
  )

  if (( ${#found[@]} == 0 )); then
    warn "No Obsidian vault found under ~. Set BRAIN_VAULT in .env manually."
    return
  fi

  local i=1 v
  for v in "${found[@]}"; do printf '  [%d] %s\n' "$i" "${v/#$HOME/~}"; ((i++)); done

  printf '%sPick a vault to use as BRAIN_VAULT [1-%d, Enter to skip]: %s' "$YELLOW" "${#found[@]}" "$RESET"
  local choice; read -r choice || true
  [[ -z "${choice:-}" ]] && { info "Skipped."; return; }
  if [[ "$choice" =~ ^[0-9]+$ ]] && (( choice >= 1 && choice <= ${#found[@]} )); then
    local pick="${found[$((choice-1))]}"
    [[ -f "$ENV_FILE" ]] || cp "$ROOT_DIR/.env.example" "$ENV_FILE"
    if grep -q '^BRAIN_VAULT=' "$ENV_FILE"; then
      # macOS/BSD sed in-place
      sed -i '' "s|^BRAIN_VAULT=.*|BRAIN_VAULT=$pick|" "$ENV_FILE" 2>/dev/null \
        || sed -i "s|^BRAIN_VAULT=.*|BRAIN_VAULT=$pick|" "$ENV_FILE"
    else
      printf 'BRAIN_VAULT=%s\n' "$pick" >> "$ENV_FILE"
    fi
    ok "BRAIN_VAULT set to ${pick/#$HOME/~}"
  else
    no "Invalid choice."
  fi
}

# ─────────────────────────────────────────────────────────────────────────────
# DOCTOR
# ─────────────────────────────────────────────────────────────────────────────
cmd_doctor() {
  head "Valet readiness"
  local ready=1
  command -v node >/dev/null 2>&1 && (( $(node -p 'process.versions.node.split(".")[0]') >= 18 )) \
    && ok "Node 18+" || { no "Node 18+"; ready=0; }
  command -v ollama >/dev/null 2>&1 && ok "Ollama" || { no "Ollama"; ready=0; }
  ollama list 2>/dev/null | grep -q nomic-embed-text && ok "Embedding model" || { warn "Embedding model not pulled"; ready=0; }
  [[ -f "$ENV_FILE" ]] && grep -qE '^ANTHROPIC_API_KEY=.+' "$ENV_FILE" && ! grep -qE 'REPLACE' "$ENV_FILE" \
    && ok "Anthropic key" || { no "Anthropic key in .env"; ready=0; }
  [[ -f "$ENV_FILE" ]] && grep -qE '^BRAIN_VAULT=.+' "$ENV_FILE" \
    && ok "Obsidian vault configured" || { warn "BRAIN_VAULT not set (run: vault)"; }
  say ""
  (( ready == 1 )) && ok "${BOLD}Laptop is ready for Valet.${RESET}" \
    || warn "Not ready yet — resolve the ✗ items above."
}

# ─────────────────────────────────────────────────────────────────────────────
main() {
  require_macos
  case "${1:-report}" in
    report)  cmd_audit; cmd_prereqs; say ""; cmd_doctor ;;
    audit)   cmd_audit ;;
    clean)   cmd_clean ;;
    prereqs) cmd_prereqs ;;
    vault)   cmd_vault ;;
    doctor)  cmd_doctor ;;
    *) sed -n '2,20p' "$0" | sed 's/^# \{0,1\}//' ;;
  esac
}
main "$@"
