#!/bin/bash

# ============================================================
#  JARVIS Setup Script
#  Runs on your Mac and sets up everything from scratch.
#  Usage: bash setup.sh
# ============================================================

set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BOLD='\033[1m'
NC='\033[0m'

print_header() {
  echo ""
  echo -e "${BLUE}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${BLUE}${BOLD}  $1${NC}"
  echo -e "${BLUE}${BOLD}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""
}

print_step() {
  echo -e "${GREEN}✓${NC} $1"
}

print_warn() {
  echo -e "${YELLOW}!${NC} $1"
}

print_error() {
  echo -e "${RED}✗${NC} $1"
}

print_info() {
  echo -e "  ${BLUE}→${NC} $1"
}

echo ""
echo -e "${BOLD}JARVIS — Setup${NC}"
echo -e "Josh's Artificial Valet Intelligence System"
echo ""
echo "This script will:"
echo "  • Create your JARVIS folder structure"
echo "  • Install required tools (Homebrew, Node.js, Git)"
echo "  • Set up Alfred and run the seed script"
echo "  • Copy your Obsidian vault template"
echo ""
read -p "Ready? Press Enter to begin or Ctrl+C to cancel..."

# ── Detect script location ───────────────────────────────────
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
ALFRED_DIR="$(dirname "$SCRIPT_DIR")"

# ── 1. Folder Structure ──────────────────────────────────────
print_header "1 / 5 — Creating folder structure"

JARVIS="$HOME/JARVIS"
REVIEW="$HOME/_Review"

folders=(
  "$JARVIS/vault"
  "$JARVIS/inbox"
  "$JARVIS/media/inspiration"
  "$JARVIS/media/images"
  "$HOME/Work"
  "$HOME/Smalley/operations"
  "$HOME/Smalley/marketing"
  "$HOME/Smalley/finances"
  "$HOME/Smalley/archive"
  "$HOME/Projects/Digital Caddie Book"
  "$HOME/Projects/Clubsmanship"
  "$HOME/Projects/Crema"
  "$HOME/Projects/Paper Filter"
  "$HOME/Archive"
  "$REVIEW/DELETE_THESE"
  "$REVIEW/NOT_SURE"
)

for folder in "${folders[@]}"; do
  if [ ! -d "$folder" ]; then
    mkdir -p "$folder"
    print_step "Created: $folder"
  else
    print_warn "Already exists: $folder"
  fi
done

# ── 2. Obsidian Vault ────────────────────────────────────────
print_header "2 / 5 — Setting up Obsidian vault"

VAULT="$JARVIS/vault"
VAULT_TEMPLATE="$ALFRED_DIR/vault-template"

if [ -d "$VAULT_TEMPLATE" ]; then
  # Copy vault template contents (non-destructive)
  cp -rn "$VAULT_TEMPLATE/." "$VAULT/" 2>/dev/null || true
  print_step "Vault template copied to $VAULT"
else
  print_warn "Vault template not found at $VAULT_TEMPLATE — skipping"
fi

# Check if Obsidian is installed
if [ -d "/Applications/Obsidian.app" ]; then
  print_step "Obsidian is installed"
else
  print_warn "Obsidian not installed — download it from https://obsidian.md"
  print_info "After installing, open it and point your vault at: $VAULT"
fi

# ── 3. Homebrew ──────────────────────────────────────────────
print_header "3 / 5 — Checking developer tools"

if command -v brew &>/dev/null; then
  print_step "Homebrew is installed ($(brew --version | head -1))"
else
  print_warn "Homebrew not found — installing..."
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
  # Add to PATH for Apple Silicon Macs
  if [ -f "/opt/homebrew/bin/brew" ]; then
    eval "$(/opt/homebrew/bin/brew shellenv)"
    echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> "$HOME/.zprofile"
  fi
  print_step "Homebrew installed"
fi

if command -v node &>/dev/null; then
  print_step "Node.js is installed ($(node --version))"
else
  print_warn "Node.js not found — installing..."
  brew install node
  print_step "Node.js installed"
fi

if command -v git &>/dev/null; then
  print_step "Git is installed ($(git --version))"
else
  print_warn "Git not found — installing..."
  brew install git
  print_step "Git installed"
fi

# ── 4. Alfred ────────────────────────────────────────────────
print_header "4 / 5 — Setting up Alfred"

ALFRED_INSTALL="$JARVIS/Alfred"

if [ -d "$ALFRED_INSTALL/.git" ]; then
  print_warn "Alfred already cloned at $ALFRED_INSTALL"
  print_info "Pulling latest changes..."
  git -C "$ALFRED_INSTALL" pull origin claude/compassionate-gates-s3l0e0 2>/dev/null || true
else
  print_info "Cloning Alfred into $ALFRED_INSTALL..."
  git clone https://github.com/joshpremuda/alfred.git "$ALFRED_INSTALL"
  git -C "$ALFRED_INSTALL" checkout claude/compassionate-gates-s3l0e0
  print_step "Alfred cloned"
fi

# Set up .env.local
if [ ! -f "$ALFRED_INSTALL/.env.local" ]; then
  cp "$ALFRED_INSTALL/.env.example" "$ALFRED_INSTALL/.env.local"
  print_step "Created .env.local"
  echo ""
  echo -e "${YELLOW}${BOLD}  ACTION REQUIRED:${NC}"
  echo -e "  Open this file and add your Anthropic API key:"
  echo -e "  ${BOLD}$ALFRED_INSTALL/.env.local${NC}"
  echo ""
  echo -e "  Get your key at: https://console.anthropic.com/keys"
  echo ""
  read -p "  Press Enter once you've added your API key..."
else
  print_step ".env.local already exists"
fi

# Verify API key is set
if grep -q "sk-ant-REPLACE_ME" "$ALFRED_INSTALL/.env.local" 2>/dev/null; then
  print_error "API key not set in .env.local — Alfred will not work until you add it."
  print_info "Edit: $ALFRED_INSTALL/.env.local"
fi

# Install npm dependencies
print_info "Installing dependencies..."
cd "$ALFRED_INSTALL"
npm install --silent
print_step "Dependencies installed"

# Seed the database
print_info "Seeding database with your projects and ideas..."
node scripts/seed.js
print_step "Database seeded"

# ── 5. Summary ───────────────────────────────────────────────
print_header "5 / 5 — Setup complete"

echo -e "${GREEN}${BOLD}Everything is ready.${NC}"
echo ""
echo -e "${BOLD}Your folders:${NC}"
echo "  ~/JARVIS/       → your second brain and AI system"
echo "  ~/Work/         → day job files"
echo "  ~/Smalley/      → Smalley Coffee business files"
echo "  ~/Projects/     → active personal projects"
echo "  ~/Archive/      → completed and reference"
echo "  ~/_Review/      → staging area for deletion (check monthly)"
echo ""
echo -e "${BOLD}Obsidian vault:${NC}"
echo "  $VAULT"
echo "  Open Obsidian → 'Open folder as vault' → select the above path"
echo ""
echo -e "${BOLD}To start Alfred:${NC}"
echo "  cd $ALFRED_INSTALL"
echo "  npm run dev"
echo "  Then open: http://localhost:3000"
echo ""
echo -e "${BOLD}To start Alfred automatically on login:${NC}"
echo "  bash $ALFRED_INSTALL/setup/install-autostart.sh"
echo ""
echo -e "─────────────────────────────────────────────────"
echo -e "  Say hello to Alfred. Good luck, Josh."
echo -e "─────────────────────────────────────────────────"
echo ""
