#!/usr/bin/env bash
# deploy.sh — One-command client deployment for Cay AI
# Usage: bash deploy.sh <client_name> <whatsapp_number> [proxy_url]
# Example: bash deploy.sh acme 12425550100 http://user:pass@123.45.67.89:8080
#
# The API key is NOT a CLI argument (that would expose it in `ps aux` and
# shell history). Provide it via the OPENROUTER_API_KEY environment variable,
# or the script will prompt for it securely.
set -euo pipefail

CLIENT_NAME="${1:?Usage: deploy.sh <client_name> <whatsapp_number> [proxy_url]}"
WHATSAPP_NUMBER="${2:?Missing whatsapp_number}"
PROXY_URL="${3:-}"

API_KEY="${OPENROUTER_API_KEY:-}"
if [ -z "$API_KEY" ]; then
  read -rsp "Enter OpenRouter API key: " API_KEY
  echo ""
fi
[ -n "$API_KEY" ] || { echo "Missing API key (set OPENROUTER_API_KEY or enter when prompted)"; exit 1; }

REPO_URL="https://github.com/gjamescollie/OutreachBey"
DEPLOY_DIR="$HOME/cay-$CLIENT_NAME"

echo "==> Deploying Cay AI for: $CLIENT_NAME"

# ─── Install Docker if missing ────────────────────────────────────────────────
if ! command -v docker &>/dev/null; then
  echo "==> Installing Docker..."
  curl -fsSL https://get.docker.com | sh
  systemctl enable --now docker
fi

# ─── Install Tailscale if missing ─────────────────────────────────────────────
if ! command -v tailscale &>/dev/null; then
  echo "==> Installing Tailscale..."
  curl -fsSL https://tailscale.com/install.sh | sh
fi

# Bring Tailscale up if not already connected
if ! tailscale status &>/dev/null; then
  echo ""
  echo "==> Tailscale not connected. Run the following to authenticate:"
  echo "    tailscale up"
  echo "    Then visit the URL it prints to authorise this machine."
  echo "    Re-run deploy.sh after connecting."
  echo ""
fi

# ─── Clone or pull repo ───────────────────────────────────────────────────────
if [ -d "$DEPLOY_DIR/.git" ]; then
  echo "==> Pulling latest..."
  git -C "$DEPLOY_DIR" pull --ff-only
else
  echo "==> Cloning repo..."
  git clone "$REPO_URL" "$DEPLOY_DIR"
fi

cd "$DEPLOY_DIR"

# ─── Write .env ───────────────────────────────────────────────────────────────
# Preserve an existing dashboard password across re-deploys; otherwise use
# $DASHBOARD_PASSWORD from the environment, or generate a strong random one.
EXISTING_PASS=""
[ -f .env ] && EXISTING_PASS=$(grep -E '^DASHBOARD_PASSWORD=' .env | cut -d= -f2- || true)
DASH_PASS="${EXISTING_PASS:-${DASHBOARD_PASSWORD:-}}"
GENERATED=0
if [ -z "$DASH_PASS" ]; then
  DASH_PASS=$(head -c 18 /dev/urandom | base64 | tr -d '/+=' | cut -c1-24)
  GENERATED=1
fi

cp .env.template .env
sed -i "s/^CLIENT_ID=.*/CLIENT_ID=$CLIENT_NAME/" .env
sed -i "s/^OPENROUTER_API_KEY=.*/OPENROUTER_API_KEY=$API_KEY/" .env
sed -i "s|^DASHBOARD_PASSWORD=.*|DASHBOARD_PASSWORD=$DASH_PASS|" .env
if [ "$GENERATED" = "1" ]; then
  echo "==> Generated dashboard password: $DASH_PASS"
  echo "    (saved to .env — store it in your password manager now)"
fi
if [ -n "$PROXY_URL" ]; then
  sed -i "s|# PROXY_URL=.*|PROXY_URL=$PROXY_URL|" .env
  echo "==> Proxy configured: $PROXY_URL"
else
  echo "==> No proxy configured (direct connection)"
fi

# ─── Scaffold data directory ──────────────────────────────────────────────────
mkdir -p data
[ -f data/settings.csv ] || echo "key,value" > data/settings.csv
[ -f data/contacts.csv ] || echo "number,name,business,tags,notes,last_contacted" > data/contacts.csv
[ -f data/log.csv ]      || echo "timestamp,to_number,to_name,message,status,tokens" > data/log.csv
[ -f followups.json ]    || echo "[]" > followups.json

# ─── Build and start ──────────────────────────────────────────────────────────
echo "==> Building Docker image..."
docker compose build

echo "==> Starting container..."
docker compose up -d

# ─── Expose dashboard via Tailscale ──────────────────────────────────────────
if tailscale status &>/dev/null; then
  tailscale serve --bg http://localhost:3000
  TS_IP=$(tailscale ip -4 2>/dev/null || echo "<tailscale-ip>")
  echo ""
  echo "==> Dashboard available at: http://${TS_IP}:3000"
  echo "    (only reachable from devices on your Tailscale network)"
fi

# ─── Show QR code ─────────────────────────────────────────────────────────────
echo ""
echo "==> Waiting for WhatsApp QR code (Ctrl+C once scanned)..."
docker compose logs -f | grep --line-buffered -A 5 "QR RECEIVED\|Scan the QR"
