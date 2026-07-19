#!/usr/bin/env bash
# install-schedule.sh — run The Paper Filter pipeline every morning (macOS launchd).
#
#   ./paper-filter/install-schedule.sh install     # schedule daily at 06:00
#   ./paper-filter/install-schedule.sh uninstall
#   ./paper-filter/install-schedule.sh status
#   ./paper-filter/install-schedule.sh logs
#
# Honors PF_HOUR (default 6) and PF_MODE (default approve).

set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LABEL="com.paperfilter.daily"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
HOUR="${PF_HOUR:-6}"
MODE="${PF_MODE:-approve}"

[[ "$(uname -s)" == "Darwin" ]] || { echo "macOS only (launchd)." >&2; exit 1; }
BASH_BIN="$(command -v bash)"

case "${1:-install}" in
  install)
    mkdir -p "$ROOT_DIR/paper-filter/.logs" "$HOME/Library/LaunchAgents"
    cat > "$PLIST" <<PLISTEOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$LABEL</string>
  <key>WorkingDirectory</key><string>$ROOT_DIR</string>
  <key>ProgramArguments</key>
  <array>
    <string>$BASH_BIN</string>
    <string>$ROOT_DIR/paper-filter/run.sh</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PF_MODE</key><string>$MODE</string>
    <key>PATH</key><string>/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
  </dict>
  <key>StartCalendarInterval</key>
  <dict><key>Hour</key><integer>$HOUR</integer><key>Minute</key><integer>0</integer></dict>
  <key>StandardOutPath</key><string>$ROOT_DIR/paper-filter/.logs/run.log</string>
  <key>StandardErrorPath</key><string>$ROOT_DIR/paper-filter/.logs/run.err.log</string>
</dict>
</plist>
PLISTEOF
    launchctl unload "$PLIST" 2>/dev/null || true
    launchctl load "$PLIST"
    echo "✓ Scheduled: The Paper Filter runs daily at ${HOUR}:00 (mode: $MODE)."
    echo "  Flip to fully automatic later:  PF_MODE=auto ./paper-filter/install-schedule.sh install"
    ;;
  uninstall)
    launchctl unload "$PLIST" 2>/dev/null || true
    rm -f "$PLIST"
    echo "✓ Daily schedule removed."
    ;;
  status) launchctl list | grep "$LABEL" || echo "Not scheduled." ;;
  logs) tail -f "$ROOT_DIR/paper-filter/.logs/run.log" "$ROOT_DIR/paper-filter/.logs/run.err.log" ;;
  *) echo "usage: install-schedule.sh [install|uninstall|status|logs]" ;;
esac
