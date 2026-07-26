#!/usr/bin/env bash
# install-launchd.sh — run Valet as a macOS login service (always-on).
#
# Usage:
#   ./scripts/install-launchd.sh install     build + install + start at login
#   ./scripts/install-launchd.sh uninstall   stop + remove the service
#   ./scripts/install-launchd.sh status       show whether it's loaded
#   ./scripts/install-launchd.sh logs         tail the service logs

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
LABEL="com.valet.app"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
PORT="${PORT:-3210}"

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "This installer is for macOS (launchd)." >&2
  exit 1
fi

NODE_BIN="$(command -v node || true)"
[[ -z "$NODE_BIN" ]] && { echo "Node.js not found on PATH. Install Node 18+ first." >&2; exit 1; }
PATH_DIR="$(dirname "$NODE_BIN")"

case "${1:-install}" in
  install)
    mkdir -p "$HOME/Library/LaunchAgents" "$ROOT_DIR/.logs"
    echo "Building Valet…"
    ( cd "$ROOT_DIR" && npm run build )

    cat > "$PLIST" <<PLISTEOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$LABEL</string>
  <key>WorkingDirectory</key><string>$ROOT_DIR</string>
  <key>ProgramArguments</key>
  <array>
    <string>$NODE_BIN</string>
    <string>$ROOT_DIR/node_modules/.bin/next</string>
    <string>start</string>
    <string>-p</string>
    <string>$PORT</string>
    <string>-H</string>
    <string>127.0.0.1</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key><string>$PATH_DIR:/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
    <key>NODE_ENV</key><string>production</string>
  </dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>$ROOT_DIR/.logs/valet.log</string>
  <key>StandardErrorPath</key><string>$ROOT_DIR/.logs/valet.err.log</string>
</dict>
</plist>
PLISTEOF

    launchctl unload "$PLIST" 2>/dev/null || true
    launchctl load "$PLIST"
    echo "✓ Valet installed as a login service ($LABEL) on http://localhost:$PORT"
    echo "  It will start automatically at login and relaunch if it crashes."
    ;;
  uninstall)
    launchctl unload "$PLIST" 2>/dev/null || true
    rm -f "$PLIST"
    echo "✓ Valet login service removed."
    ;;
  status)
    launchctl list | grep "$LABEL" || echo "Not loaded."
    ;;
  logs)
    tail -f "$ROOT_DIR/.logs/valet.log" "$ROOT_DIR/.logs/valet.err.log"
    ;;
  *)
    echo "usage: install-launchd.sh [install|uninstall|status|logs]"
    ;;
esac
