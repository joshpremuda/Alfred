#!/usr/bin/env bash
# Smalley VALET — Update Script
# Run this when Claude tells you to update the system.

set -euo pipefail

VALET_DIR="/opt/valet"

echo "[update] Updating VALET…"

# Pull latest n8n image
cd "${VALET_DIR}/n8n"
docker compose pull
docker compose up -d
docker image prune -f

# Update Node.js dependencies
cd "${VALET_DIR}"
npm install --omit=dev

# Restart VALET bot service
systemctl restart valet-bot

echo "[update] VALET updated successfully at $(date)"
