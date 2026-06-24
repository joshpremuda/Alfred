#!/bin/bash
# Installs the launchd agent so Alfred posts to Instagram every hour.
# Run from the Alfred root: bash tools/instagram/install_launchd.sh

set -e

ALFRED_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
PLIST_SRC="$ALFRED_DIR/launchd/com.alfred.instagram.plist"
PLIST_DEST="$HOME/Library/LaunchAgents/com.alfred.instagram.plist"
LOG_DIR="$ALFRED_DIR/logs"

mkdir -p "$LOG_DIR"

# Load IMGBB_API_KEY from .env
if [ -f "$ALFRED_DIR/.env" ]; then
  export $(grep -v '^#' "$ALFRED_DIR/.env" | xargs)
fi

if [ -z "$IMGBB_API_KEY" ]; then
  echo "ERROR: IMGBB_API_KEY not found in .env. Run setup first: python3 tools/instagram/setup.py"
  exit 1
fi

# Substitute placeholders
sed \
  -e "s|ALFRED_PATH|$ALFRED_DIR|g" \
  -e "s|REPLACE_WITH_IMGBB_KEY|$IMGBB_API_KEY|g" \
  "$PLIST_SRC" > "$PLIST_DEST"

# Unload if already loaded
launchctl unload "$PLIST_DEST" 2>/dev/null || true
launchctl load "$PLIST_DEST"

echo "✓ Instagram scheduler installed and active."
echo "  Logs: $LOG_DIR/instagram.log"
echo "  Runs every hour — Alfred will post at the best time windows."
echo ""
echo "  To test now:  python3 tools/instagram/poster.py --dry-run"
echo "  Force a post: python3 tools/instagram/poster.py --force"
echo "  Uninstall:    launchctl unload ~/Library/LaunchAgents/com.alfred.instagram.plist"
