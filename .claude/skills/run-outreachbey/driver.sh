#!/usr/bin/env bash
# Cay AI agent driver — starts the HTTP dashboard and smoke-tests it.
# WhatsApp connection requires a real phone + QR scan; the HTTP layer works without it.
# Usage: bash .claude/skills/run-outreachbey/driver.sh [screenshot]
set -e

REPO=$(cd "$(dirname "$0")/../../.." && pwd)
SCRATCHPAD="${TMPDIR:-/tmp}/cayai-driver"
mkdir -p "$SCRATCHPAD"

# ── 1. Minimal data files (skip if already present) ───────────────────────────
mkdir -p "$REPO/data"
[ -f "$REPO/data/settings.csv" ] || cp "$REPO/demo/settings_beauty.csv" "$REPO/data/settings.csv"
[ -f "$REPO/data/contacts.csv" ] || echo "number,name,business,tags,notes,last_contacted" > "$REPO/data/contacts.csv"
[ -f "$REPO/data/log.csv" ]      || echo "timestamp,to_number,to_name,message,status,tokens,confidence,direction,extra" > "$REPO/data/log.csv"
[ -f "$REPO/followups.json" ]    || echo "[]" > "$REPO/followups.json"

# ── 2. Start the agent ─────────────────────────────────────────────────────────
# --unhandled-rejections=none prevents WhatsApp network errors from killing the process
# IS_DOCKER=true selects the PUPPETEER_EXECUTABLE_PATH branch in index.js
OPENROUTER_API_KEY="${OPENROUTER_API_KEY:-test-key-smoke}" \
DASHBOARD_PASSWORD="${DASHBOARD_PASSWORD:-cayai2024}" \
IS_DOCKER=true \
PUPPETEER_EXECUTABLE_PATH="${PUPPETEER_EXECUTABLE_PATH:-/usr/bin/chromium}" \
  node --unhandled-rejections=none "$REPO/index.js" &
APP_PID=$!
echo "▶ Agent PID $APP_PID"

cleanup() { kill "$APP_PID" 2>/dev/null; wait "$APP_PID" 2>/dev/null; }
trap cleanup EXIT INT TERM

# ── 3. Poll /health until ready ───────────────────────────────────────────────
echo "⏳ Waiting for HTTP server on :3000 …"
for i in $(seq 1 30); do
  HEALTH=$(curl -s --max-time 1 http://localhost:3000/health 2>/dev/null)
  if [ -n "$HEALTH" ]; then
    echo "✅ Health: $HEALTH"
    break
  fi
  [ "$i" -eq 30 ] && { echo "❌ Timed out waiting for /health"; exit 1; }
  sleep 0.5
done

# ── 4. Smoke tests ────────────────────────────────────────────────────────────
echo ""
echo "── Smoke: /health (unauthenticated) ──"
curl -s http://localhost:3000/health | grep -q '"status":"ok"' && echo "PASS" || echo "FAIL"

echo "── Smoke: / without auth → redirect to /login ──"
CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/)
[ "$CODE" = "302" ] && echo "PASS (302 redirect)" || echo "FAIL (got $CODE)"

echo "── Smoke: /login page renders ──"
curl -s http://localhost:3000/login | grep -q "Cay AI" && echo "PASS" || echo "FAIL"

echo "── Smoke: POST /login with correct password → 302 to / ──"
CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
  -d "password=${DASHBOARD_PASSWORD:-cayai2024}" \
  http://localhost:3000/login)
[ "$CODE" = "302" ] && echo "PASS (302 redirect)" || echo "FAIL (got $CODE)"

echo "── Smoke: POST /login with wrong password → 302 to /login?err=1 ──"
LOCATION=$(curl -s -D - -o /dev/null -X POST -d "password=wrongpass" http://localhost:3000/login | grep -i "^location:")
echo "$LOCATION" | grep -q "err=1" && echo "PASS" || echo "FAIL"

echo "── Smoke: dashboard with valid auth cookie ──"
COOKIE="dash_auth=${DASHBOARD_PASSWORD:-cayai2024}"
curl -s -H "Cookie: $COOKIE" http://localhost:3000/ | grep -q "Cay AI Dashboard" && echo "PASS" || echo "FAIL"

# ── 5. Optional screenshot ─────────────────────────────────────────────────────
if [ "${1:-}" = "screenshot" ]; then
  CHROME="${PLAYWRIGHT_BROWSERS_PATH:-/opt/pw-browsers}/chromium-1194/chrome-linux/chrome"
  [ -f "$CHROME" ] || CHROME=$(which chromium chromium-browser 2>/dev/null | head -1)
  SS="$SCRATCHPAD/dashboard.png"

  node --input-type=module <<EOF 2>&1
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const browser = await chromium.launch({
  executablePath: '$CHROME',
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});
const page = await browser.newPage();
await page.setViewportSize({ width: 1280, height: 900 });
await page.goto('http://localhost:3000/login', { timeout: 8000 });
await page.fill('input[name="password"]', '${DASHBOARD_PASSWORD:-cayai2024}');
await page.click('button[type="submit"]');
await page.waitForTimeout(600);
await page.screenshot({ path: '$SS' });
await browser.close();
console.log('Screenshot saved: $SS');
EOF
fi

echo ""
echo "✅ Smoke suite complete. Stopping agent …"
