# OutreachBey — Future Plans

## Overview
Add two things to make OutreachBey production-ready for uptime:
1. **Daily WhatsApp status report** — agent messages the owner every morning with a health summary
2. **pm2 config** — process manager that auto-restarts on crash and survives Mac reboots

Both changes are self-contained and do not touch any existing logic.

---

## Part 1 — Daily Status Report (`index.js`)

### What to add
A new function `startHeartbeat()` that schedules a daily WhatsApp message to the owner at a configurable time (default 8:00am Bahamas time).

### Where to add it
In `index.js`, after the `startFollowUpChecker()` function and before the `handleInbound()` section. Call it inside the `client.on('ready', ...)` event alongside `startFollowUpChecker()`.

### The function

```javascript
// ─── DAILY HEARTBEAT ──────────────────────────────────────────────────────────
function startHeartbeat() {
  const HEARTBEAT_HOUR   = 8;  // 8am Bahamas time
  const HEARTBEAT_MINUTE = 0;

  function scheduleNext() {
    const now = new Date();
    const next = new Date(now.getFullYear(), now.getMonth(), now.getDate(), HEARTBEAT_HOUR, HEARTBEAT_MINUTE, 0);
    if (next <= now) next.setDate(next.getDate() + 1);
    const delay = next.getTime() - now.getTime();
    setTimeout(async () => {
      await sendHeartbeat();
      scheduleNext(); // reschedule for next day
    }, delay);
    console.log(`💓 Heartbeat scheduled for ${next.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`);
  }

  async function sendHeartbeat() {
    try {
      const settings = getSettings();
      const ownerNumber = formatNumber(settings.owner_number || '');
      if (!ownerNumber) return;

      const stats = getStats();
      const pending = followUps.length;
      const uptimeHours = Math.floor(process.uptime() / 3600);
      const uptimeMins  = Math.floor((process.uptime() % 3600) / 60);

      const lines = [
        `✅ *OutreachBey is live* — ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
        ``,
        `📊 *Today:* ${stats?.today ?? 0} messages sent`,
        `📅 *Scheduled:* ${pending} pending`,
        `📨 *All time:* ${stats?.total ?? 0} messages`,
        `⏱ *Uptime:* ${uptimeHours}h ${uptimeMins}m`,
        `🤖 *Model:* ${AI_MODEL}`,
      ];

      await client.sendMessage(ownerNumber, lines.join('\n'));
      console.log('💓 Heartbeat sent');
    } catch (e) {
      console.error('Heartbeat failed:', e.message);
    }
  }

  scheduleNext();
}
```

### Update the ready event
Find this block in `index.js`:
```javascript
client.on('ready', () => {
  const settings = getSettings();
  console.log(`🚀 ${settings.business_name || 'GJC Digital'} WhatsApp Agent is live!`);
  console.log(`🤖 AI Provider: ${AI_PROVIDER} | Model: ${AI_MODEL}`);
  startFollowUpChecker();
});
```

Change it to:
```javascript
client.on('ready', () => {
  const settings = getSettings();
  console.log(`🚀 ${settings.business_name || 'GJC Digital'} WhatsApp Agent is live!`);
  console.log(`🤖 AI Provider: ${AI_PROVIDER} | Model: ${AI_MODEL}`);
  startFollowUpChecker();
  startHeartbeat();
});
```

### Add `!status` command (optional but useful)
Add this command block inside the `message_create` listener so the owner can trigger a status report on demand:

```javascript
// ── STATUS ──
if (lower === '!status') {
  const stats = getStats();
  const pending = followUps.length;
  const uptimeHours = Math.floor(process.uptime() / 3600);
  const uptimeMins  = Math.floor((process.uptime() % 3600) / 60);
  await msg.reply(
    `✅ *Agent Status*\n\n` +
    `📊 *Today:* ${stats?.today ?? 0} messages\n` +
    `📅 *Scheduled:* ${pending} pending\n` +
    `📨 *All time:* ${stats?.total ?? 0} messages\n` +
    `⏱ *Uptime:* ${uptimeHours}h ${uptimeMins}m\n` +
    `🤖 *Model:* ${AI_MODEL}\n` +
    `🔌 *Provider:* ${AI_PROVIDER}`
  );
  return;
}
```

Also add `*!status*\n→ Check agent health and stats\n\n` to the `!help` reply string.

---

## Part 2 — pm2 Config (new file)

### Create `ecosystem.config.js` in the project root

```javascript
module.exports = {
  apps: [
    {
      name: 'outreachbey',
      script: './index.js',
      watch: false,
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      restart_delay: 5000,
      env: {
        NODE_ENV: 'production',
        PUPPETEER_EXECUTABLE_PATH: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      },
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
    },
  ],
};
```

### Create the logs directory
```bash
mkdir -p logs
echo "*.log" >> .gitignore
```

### One-time pm2 install (run manually, not by Claude Code)
```bash
npm install -g pm2
```

---

## Part 3 — Update `start.command`

Replace the existing `start.command` content with this updated version that uses pm2 if available, falls back to node if not:

```bash
#!/bin/bash
cd "$(dirname "$0")"

echo "🚀 Starting OutreachBey..."

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
  echo "📦 Installing dependencies..."
  npm install --ignore-scripts
fi

# Create logs dir if missing
mkdir -p logs

# Use pm2 if installed, otherwise fall back to node
if command -v pm2 &> /dev/null; then
  echo "⚙️  Starting with pm2 (auto-restart enabled)..."
  pm2 start ecosystem.config.js --no-daemon
else
  echo "⚠️  pm2 not found — running directly with node"
  echo "   Install pm2 for auto-restart: npm install -g pm2"
  PUPPETEER_EXECUTABLE_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" node index.js
fi
```

---

---

## Part 4 — Email Digest (Future)

Send `review.html` content as a formatted HTML email on Sunday mornings alongside the WhatsApp report. Uses Resend or SendGrid free tier — one `fetch()` call, no npm package needed.

**What to add:**
- `OUTREACH_EMAIL_KEY` to `.env`
- `OUTREACH_EMAIL_TO` to `.env` (owner's email)
- A `sendReviewEmail(htmlContent)` helper inside `startReviewAgent()` that posts to the Resend/SendGrid API
- Call it on Sundays after `writeReviewHTML()`

**Why Resend over SendGrid:** Simpler API (one JSON body, no template IDs), generous free tier (3,000 emails/month), and `.bs` domain emails are less likely to be flagged as spam.

---

## Checklist for Claude Code

- [ ] Add `startHeartbeat()` function to `index.js` after `startFollowUpChecker()`
- [ ] Call `startHeartbeat()` inside the `client.on('ready', ...)` event
- [ ] Add `!status` command to the `message_create` listener
- [ ] Add `!status` to the `!help` reply string
- [ ] Create `ecosystem.config.js` in project root
- [ ] Create `logs/` directory (with a `.gitkeep` inside)
- [ ] Update `start.command` with pm2-aware launcher
- [ ] Add `logs/*.log` to `.gitignore`

---

## Notes for Implementation

- `startHeartbeat()` uses a recursive `setTimeout` pattern (not `setInterval`) so the schedule self-corrects daily without drift
- `HEARTBEAT_HOUR` and `HEARTBEAT_MINUTE` can be changed at the top of the function — no other changes needed
- pm2 `max_restarts: 10` with `min_uptime: '10s'` means if it crashes 10 times in under 10 seconds each, pm2 stops trying — prevents infinite crash loops
- The `logs/` directory must exist before pm2 starts or it will fail silently — the `start.command` handles this with `mkdir -p logs`
- `!status` is purely read-only — no risk, safe to add at any time
