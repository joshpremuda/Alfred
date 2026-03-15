#!/usr/bin/env bash
# Smalley VALET — Oracle Cloud Server Setup
# Run as root on Ubuntu 24.04
# Usage: bash server-setup.sh

set -euo pipefail

VALET_DIR="/opt/valet"
DOMAIN="${N8N_DOMAIN:-valet.smalleycoffee.com}"
N8N_PASSWORD="${N8N_PASSWORD:-$(openssl rand -base64 24 | tr -d '=+/')}"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BOLD='\033[1m'; RESET='\033[0m'
info()    { echo -e "${GREEN}[setup]${RESET} $*"; }
warn()    { echo -e "${YELLOW}[setup]${RESET} $*"; }
error()   { echo -e "${RED}[setup]${RESET} $*" >&2; }
section() { echo -e "\n${BOLD}── $* ──${RESET}\n"; }

# ── Phase 1: System packages ─────────────────────────────────────────────
section "System packages"
apt-get update -qq
apt-get upgrade -y -qq
apt-get install -y -qq \
  curl git nginx certbot python3-certbot-nginx \
  ufw fail2ban

info "System packages installed"

# ── Phase 2: Docker ───────────────────────────────────────────────────────
section "Docker"
if ! command -v docker &>/dev/null; then
  curl -fsSL https://get.docker.com | sh
  systemctl enable --now docker
  info "Docker installed"
else
  info "Docker already installed"
fi

# ── Phase 3: Node.js 20 ───────────────────────────────────────────────────
section "Node.js"
if ! command -v node &>/dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
  info "Node.js $(node --version) installed"
else
  info "Node.js $(node --version) already installed"
fi

# ── Phase 4: VALET directory ──────────────────────────────────────────────
section "VALET directory"
mkdir -p "${VALET_DIR}"/{n8n,backups,logs}
cd "${VALET_DIR}"

# Copy repo files if running from git checkout
if [[ -d "/tmp/Alfred" ]]; then
  cp -r /tmp/Alfred/* "${VALET_DIR}/"
  info "Repo files copied to ${VALET_DIR}"
fi

# ── Phase 5: Environment file ─────────────────────────────────────────────
section "Environment"
ENV_FILE="${VALET_DIR}/.env"
if [[ ! -f "$ENV_FILE" ]]; then
  if [[ -f "${VALET_DIR}/.env.example" ]]; then
    cp "${VALET_DIR}/.env.example" "$ENV_FILE"
    info "Created .env from template"
  else
    touch "$ENV_FILE"
  fi
fi

# Set generated n8n password
if ! grep -q "^N8N_PASSWORD=" "$ENV_FILE" 2>/dev/null || grep -q "REPLACE" "$ENV_FILE"; then
  sed -i "s|^N8N_PASSWORD=.*|N8N_PASSWORD=${N8N_PASSWORD}|" "$ENV_FILE" 2>/dev/null || \
    echo "N8N_PASSWORD=${N8N_PASSWORD}" >> "$ENV_FILE"
fi
sed -i "s|^N8N_DOMAIN=.*|N8N_DOMAIN=${DOMAIN}|" "$ENV_FILE" 2>/dev/null || \
  echo "N8N_DOMAIN=${DOMAIN}" >> "$ENV_FILE"

chmod 600 "$ENV_FILE"
info ".env configured"

# ── Phase 6: n8n via Docker ───────────────────────────────────────────────
section "n8n"
N8N_COMPOSE="${VALET_DIR}/n8n/docker-compose.yml"
if [[ ! -f "$N8N_COMPOSE" ]]; then
  error "n8n/docker-compose.yml not found — ensure repo is cloned to ${VALET_DIR}"
  exit 1
fi

cd "${VALET_DIR}/n8n"
set -a; source "${VALET_DIR}/.env"; set +a
docker compose up -d
info "n8n started"

# ── Phase 7: Nginx + SSL ──────────────────────────────────────────────────
section "Nginx + SSL"
cat > /etc/nginx/sites-available/valet << NGINX
server {
    listen 80;
    server_name ${DOMAIN};

    location / {
        proxy_pass http://127.0.0.1:5678;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 86400;
    }
}
NGINX

ln -sf /etc/nginx/sites-available/valet /etc/nginx/sites-enabled/valet
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
info "Nginx configured"

# SSL
if command -v certbot &>/dev/null; then
  certbot --nginx -d "${DOMAIN}" --non-interactive --agree-tos \
    --email "josh@smalleycoffee.com" --redirect || \
    warn "SSL setup failed — ensure DNS points to this server first"
fi

# ── Phase 8: Node.js VALET bot ───────────────────────────────────────────
section "VALET bot dependencies"
cd "${VALET_DIR}"
npm install --omit=dev
info "npm packages installed"

# ── Phase 9: systemd service for VALET bot ───────────────────────────────
section "systemd service"
cat > /etc/systemd/system/valet-bot.service << SYSTEMD
[Unit]
Description=Smalley VALET Telegram Bot
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=${VALET_DIR}
EnvironmentFile=${VALET_DIR}/.env
ExecStart=/usr/bin/node ${VALET_DIR}/telegram/valet.js
Restart=always
RestartSec=10
StandardOutput=append:${VALET_DIR}/logs/valet-bot.log
StandardError=append:${VALET_DIR}/logs/valet-bot.log

[Install]
WantedBy=multi-user.target
SYSTEMD

systemctl daemon-reload
systemctl enable valet-bot
systemctl start valet-bot
info "VALET bot service started"

# ── Phase 10: Firewall ────────────────────────────────────────────────────
section "Firewall"
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
info "Firewall configured"

# ── Phase 11: Cron jobs ───────────────────────────────────────────────────
section "Maintenance crons"
(crontab -l 2>/dev/null; echo "0 * * * * ${VALET_DIR}/scripts/health-check.sh >> ${VALET_DIR}/logs/health.log 2>&1") | crontab -
(crontab -l 2>/dev/null; echo "0 2 * * 0 ${VALET_DIR}/scripts/backup.sh >> ${VALET_DIR}/logs/backup.log 2>&1") | crontab -
info "Cron jobs scheduled"

# ── Summary ───────────────────────────────────────────────────────────────
section "Setup Complete"
echo ""
echo -e "${BOLD}VALET is ready.${RESET}"
echo ""
echo "  n8n URL:     https://${DOMAIN}"
echo "  n8n login:   valet / ${N8N_PASSWORD}"
echo "  Bot service: systemctl status valet-bot"
echo "  Bot logs:    tail -f ${VALET_DIR}/logs/valet-bot.log"
echo ""
echo -e "${YELLOW}Next steps:${RESET}"
echo "  1. Edit ${ENV_FILE} and add your API keys"
echo "  2. systemctl restart valet-bot"
echo "  3. Import n8n workflows from ${VALET_DIR}/n8n/workflows/"
echo "  4. Run: node ${VALET_DIR}/scripts/setup-notion.js"
echo ""
