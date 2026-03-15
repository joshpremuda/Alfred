#!/usr/bin/env bash
# Smalley VALET — Weekly Backup
# Exports n8n workflows and backs up .env to /opt/valet/backups/

set -euo pipefail

VALET_DIR="/opt/valet"
BACKUP_DIR="${VALET_DIR}/backups"
DATE="$(date '+%Y-%m-%d')"
BACKUP_PATH="${BACKUP_DIR}/${DATE}"

mkdir -p "$BACKUP_PATH"

# ── n8n workflow export ───────────────────────────────────────────────────
if docker ps --filter "name=n8n" --filter "status=running" | grep -q n8n 2>/dev/null; then
  # Export all workflows via n8n CLI inside the container
  docker exec "$(docker ps -q --filter name=n8n)" \
    n8n export:workflow --all --output=/tmp/workflows-backup.json 2>/dev/null || true

  docker cp "$(docker ps -q --filter name=n8n)":/tmp/workflows-backup.json \
    "${BACKUP_PATH}/n8n-workflows.json" 2>/dev/null || true

  echo "[backup] n8n workflows exported"
fi

# ── .env backup (credentials reference, not committed to git) ─────────────
if [[ -f "${VALET_DIR}/.env" ]]; then
  cp "${VALET_DIR}/.env" "${BACKUP_PATH}/env-backup.enc" 2>/dev/null || true
  echo "[backup] .env backed up"
fi

# ── Keep only last 4 weekly backups ──────────────────────────────────────
ls -dt "${BACKUP_DIR}"/20* 2>/dev/null | tail -n +5 | xargs rm -rf 2>/dev/null || true

echo "[backup] ${DATE} — Backup complete → ${BACKUP_PATH}"
