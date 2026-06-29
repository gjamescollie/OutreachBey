---
name: run-outreachbey
description: run, start, launch, smoke test, screenshot, build, test the Cay AI WhatsApp agent or its dashboard
---

Cay AI is a Node.js WhatsApp outreach agent with a password-protected HTTP dashboard on port 3000. The agent connects to WhatsApp via Puppeteer (QR scan required for full operation); the HTTP layer — health check, login, dashboard — works without a live WhatsApp session. The driver script at `.claude/skills/run-outreachbey/driver.sh` starts the agent, polls `/health`, and runs six curl smoke tests.

## Prerequisites

No extra OS packages needed in this repo's container. Dependencies are already in `node_modules/`.

For a fresh machine:

```bash
npm ci --omit=dev
```

Playwright (for screenshots) is pre-installed at `/opt/node22/lib/node_modules/playwright`.

## Setup

Minimal data files (the driver creates these automatically if absent):

```bash
mkdir -p data
cp demo/settings_beauty.csv data/settings.csv
echo "number,name,business,tags,notes,last_contacted" > data/contacts.csv
echo "timestamp,to_number,to_name,message,status,tokens,confidence,direction,extra" > data/log.csv
echo "[]" > followups.json
```

## Run — agent path (driver)

```bash
# Smoke suite (starts agent, polls health, 6 curl checks, stops)
bash .claude/skills/run-outreachbey/driver.sh

# Smoke + screenshot of the dashboard (saved to /tmp/cayai-driver/dashboard.png)
bash .claude/skills/run-outreachbey/driver.sh screenshot
```

All six checks print PASS/FAIL. The agent process is killed on exit.

## Run — manual

Start the agent in the foreground. Use these env vars in any containerised or headless environment:

```bash
OPENROUTER_API_KEY=<your-key> \
DASHBOARD_PASSWORD=cayai2024 \
IS_DOCKER=true \
PUPPETEER_EXECUTABLE_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome \
  node --unhandled-rejections=none index.js
```

Then open `http://localhost:3000` in a browser. Password: `cayai2024` (or `$DASHBOARD_PASSWORD`).

On a real Mac client deployment, omit `IS_DOCKER` and `PUPPETEER_EXECUTABLE_PATH` — the agent uses the system Google Chrome path hardcoded in `index.js:1181`.

## HTTP endpoints (curl)

```bash
# Health — no auth required
curl http://localhost:3000/health
# → {"status":"ok","client_id":"default","uptime":N}

# Login page
curl http://localhost:3000/login | grep "Cay AI"

# POST login → 302 + auth cookie
curl -s -o /dev/null -w "%{http_code}" -X POST -d "password=cayai2024" http://localhost:3000/login
# → 302

# Dashboard — requires auth cookie
curl -s -H "Cookie: dash_auth=cayai2024" http://localhost:3000/ | grep "Cay AI Dashboard"
```

## Tests

```bash
npm test
```

The test suite mocks `whatsapp-web.js` (no QR scan, no network). There are currently some stale test failures:
- `fetchNewsHeadlines` tests — function was removed; tests still reference it
- `appendToLog` column-count tests — log format has 9 columns now, tests expect 7
- `handleInbound` classification tests — mock fetch returns `{}`, classifier returns null; tests assume a real response

These failures are pre-existing and do not affect agent operation.

## Gotchas

**WhatsApp init crashes the process on this machine.** In the container, Puppeteer reaches `web.whatsapp.com` and fails with `net::ERR_TUNNEL_CONNECTION_FAILED` (outbound HTTPS is proxied but WhatsApp's WebSocket is blocked). This raises an unhandled rejection that kills Node. Fix: `--unhandled-rejections=none`. The HTTP server starts and binds before WhatsApp init runs, so it survives.

**Chromium profile lock.** If a previous run crashed, `.wwebjs_auth/` contains a lock file from another machine. `rm -rf .wwebjs_auth` clears it.

**`IS_DOCKER=true` is required on Linux.** Without it, `index.js:1181` hardcodes the macOS Chrome path (`/Applications/Google Chrome.app/...`) and crashes immediately.

**Port 3000 conflict.** If a previous agent is still running, `listen EADDRINUSE :3000` will crash the new one. Kill with `pkill -f "node.*index.js"`.

**The dashboard screenshot takes ~3 seconds.** Playwright needs to launch its own Chromium instance, which is separate from the one Puppeteer uses for WhatsApp. Both can coexist.
