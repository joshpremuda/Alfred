#!/bin/bash

# ============================================================
#  JARVIS — Install Alfred as a macOS login item
#  Runs Alfred automatically every time you log in.
#  Usage: bash setup/install-autostart.sh
# ============================================================

set -e

ALFRED_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )/.." && pwd )"
PLIST_NAME="com.jarvis.alfred"
PLIST_PATH="$HOME/Library/LaunchAgents/$PLIST_NAME.plist"
NODE_PATH="$(which node)"
NPM_PATH="$(which npm)"

echo ""
echo "Installing Alfred auto-start..."

# Unload existing if present
if launchctl list | grep -q "$PLIST_NAME" 2>/dev/null; then
  launchctl unload "$PLIST_PATH" 2>/dev/null || true
  echo "  → Removed existing auto-start"
fi

# Write plist
cat > "$PLIST_PATH" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>${PLIST_NAME}</string>
    <key>ProgramArguments</key>
    <array>
        <string>${NPM_PATH}</string>
        <string>start</string>
    </array>
    <key>WorkingDirectory</key>
    <string>${ALFRED_DIR}</string>
    <key>EnvironmentVariables</key>
    <dict>
        <key>NODE_ENV</key>
        <string>production</string>
        <key>PORT</key>
        <string>3000</string>
        <key>PATH</key>
        <string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin</string>
    </dict>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>/tmp/jarvis-alfred.log</string>
    <key>StandardErrorPath</key>
    <string>/tmp/jarvis-alfred-error.log</string>
</dict>
</plist>
EOF

# Must build first for production start
echo "  → Building Alfred for production..."
cd "$ALFRED_DIR"
npm run build --silent

# Load the plist
launchctl load "$PLIST_PATH"

echo ""
echo "✓ Alfred will now start automatically on login."
echo ""
echo "  Alfred is running at: http://localhost:3000"
echo "  Logs: /tmp/jarvis-alfred.log"
echo ""
echo "  To stop auto-start:"
echo "  launchctl unload ~/Library/LaunchAgents/$PLIST_NAME.plist"
echo ""
