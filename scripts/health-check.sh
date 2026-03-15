#!/usr/bin/env bash
# Smalley VALET — Health Check
# Run hourly via cron. Sends Telegram alert if anything is down.

set -euo pipefail

VALET_DIR="/opt/valet"
ENV_FILE="${VALET_DIR}/.env"

[[ -f "$ENV_FILE" ]] && set -a && source "$ENV_FILE" && set +a

BOT_TOKEN="${TELEGRAM_BOT_TOKEN:-}"
OWNER_ID="${TELEGRAM_OWNER_ID:-}"
N8N_DOMAIN="${N8N_DOMAIN:-localhost}"
TIMESTAMP="$(date '+%Y-%m-%d %H:%M %Z')"

failures=()

alert() {
  local msg="⚠️ VALET Health Alert\n$TIMESTAMP\n\n$*"
  if [[ -n "$BOT_TOKEN" && -n "$OWNER_ID" ]]; then
    curl -s -X POST "https://api.telegram.org/bot${BOT_TOKEN}/sendMessage" \
      -H "Content-Type: application/json" \
      -d "{\"chat_id\":\"${OWNER_ID}\",\"text\":\"${msg}\"}" > /dev/null
  fi
  echo "[health] ALERT: $*"
}

# ── Check n8n ─────────────────────────────────────────────────────────────
if ! curl -sf --max-time 10 "http://127.0.0.1:5678/healthz" > /dev/null 2>&1; then
  failures+=("n8n is not responding")
  # Try to restart
  cd "${VALET_DIR}/n8n" && docker compose restart n8n 2>/dev/null || true
fi

# ── Check VALET bot ───────────────────────────────────────────────────────
if ! systemctl is-active --quiet valet-bot 2>/dev/null; then
  failures+=("valet-bot service is stopped")
  systemctl start valet-bot 2>/dev/null || true
fi

# ── Check nginx ───────────────────────────────────────────────────────────
if ! systemctl is-active --quiet nginx 2>/dev/null; then
  failures+=("nginx is stopped")
  systemctl start nginx 2>/dev/null || true
fi

# ── Check disk (warn > 80%) ───────────────────────────────────────────────
DISK_PCT=$(df / | awk 'NR==2 {print $5}' | tr -d '%')
if [[ "$DISK_PCT" -gt 80 ]]; then
  failures+=("Disk usage at ${DISK_PCT}% — clean up soon")
fi

# ── Docker health ─────────────────────────────────────────────────────────
if ! docker ps --filter "name=n8n" --filter "status=running" | grep -q n8n 2>/dev/null; then
  failures+=("n8n Docker container is not running")
fi

# ── Report ────────────────────────────────────────────────────────────────
if [[ ${#failures[@]} -gt 0 ]]; then
  msg="$(printf '%s\n' "${failures[@]}")"
  alert "$msg"
  exit 1
else
  echo "[health] $TIMESTAMP — All systems OK"
fi
