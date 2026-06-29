# Cay AI — Handoff Guide

Everything a new developer (or future-you returning after a break) needs to understand, run, and extend Cay AI without re-reading the full conversation history.

---

## The Short Version
Cay AI is a Node.js WhatsApp agent + operator dashboard that:
1. Connects to WhatsApp via a linked device (QR scan, like WhatsApp Web)
2. Lets the owner send AI-written outreach messages via `!commands` from WhatsApp
3. Automatically classifies and responds to inbound messages using AI
4. Stores everything in CSV files — no database
5. Serves a password-gated operator console on `:3000` (Logs, Analytics, Contacts, Settings)

One instance per client. Each client has their own WhatsApp number and Docker container on their own droplet.

---

## Credentials & Keys
- **OpenRouter API key:** in `.env` as `OPENROUTER_API_KEY`
- **Default AI model:** `anthropic/claude-haiku-4-5` via OpenRouter
- **Dashboard password:** in `.env` as `DASHBOARD_PASSWORD` (never commit)
- **Calendar:** https://calendly.com/gjamescollie/30min

---

## Running Locally (Mac)

```bash
# First time
npm install --ignore-scripts

# Start (double-click or terminal)
DASHBOARD_PASSWORD=yourpassword node index.js
# or just double-click start.command
```

Dashboard at `http://localhost:3000` — password from `.env`.

## Running in Docker

```bash
# Start
docker compose up -d

# View logs
docker compose logs -f outreachbey

# Stop
docker compose down

# Full rebuild after code changes
docker compose build --no-cache && docker compose up -d
```

---

## Testing AI Connection

```bash
node -e "
require('dotenv').config();
fetch('https://openrouter.ai/api/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + process.env.OPENROUTER_API_KEY,
    'Content-Type': 'application/json',
    'HTTP-Referer': 'https://lucayanlabs.com',
    'X-Title': 'Cay AI',
  },
  body: JSON.stringify({
    model: 'anthropic/claude-haiku-4-5',
    max_tokens: 50,
    messages: [{ role: 'user', content: 'Reply with the word WORKING' }]
  })
}).then(r => r.json()).then(d => console.log(d?.choices?.[0]?.message?.content)).catch(console.error);
"
```

Should print `WORKING`. An `error` key in the response means bad API key or invalid model.

---

## index.js Section Map (in order)

| Section | What it does |
|---|---|
| `require / dotenv` | Load env vars |
| `callAI()` | Routes AI calls to correct provider, returns `{ text, tokens }` |
| `generateMessage()` | Builds system prompt from settings + contact, calls AI |
| `generateCheckin()` | Same but for check-in messages |
| `buildTemplateFallback()` | Template fallback if AI fails |
| `parseCSV()` | Reads CSV files, skips comment lines |
| `appendToLog()` | Writes to log.csv |
| `updateLastContacted()` | Updates contacts.csv |
| `getSettings()` | Returns settings.csv as key/value object |
| `findContact()` | Lookup by number |
| `findContactByName()` | Lookup by name (partial match) |
| `resolveRecipient()` | Accepts name or number, returns `{ resolved, rawNumber, contact }` |
| `getContactsByTag()` | Returns contacts with a given tag |
| `getFAQAnswer()` | Keyword-based KB lookup |
| `getStats()` | Reads log.csv, returns counts + ROI metrics |
| `loadFollowUps() / saveFollowUps()` | followups.json persistence |
| `pendingPreviews` | In-memory store for messages awaiting yes/no approval |
| `pendingPurpose` | In-memory store for commands awaiting purpose selection |
| `MESSAGE_PURPOSES` | 5 purpose categories with AI guidance strings |
| `SETUP_STEPS` | 18-step setup wizard definition |
| `saveSettings()` | Writes settings.csv, preserving fields not in wizard |
| `handleSetup()` | Setup wizard state machine |
| `waState` | Tracks WA connection: `connecting` / `connected` / `disconnected` |
| `CLIENT SETUP` | whatsapp-web.js client initialization |
| `message listener` | Inbound handler — fires handleInbound() |
| `message_create listener` | Owner command handler — !send, !checkin, !broadcast etc. |
| `handleBroadcastApproval()` | Loops through contacts and sends broadcast |
| `startFollowUpChecker()` | 30s interval, fires due scheduled messages |
| `classifyIntent()` | AI intent classifier |
| `handleInbound()` | Routes inbound by classified intent |
| `HEALTH + DASHBOARD` | HTTP server on :3000, all /api/* endpoints |
| `client.initialize()` | Starts everything |

---

## Key Functions

### `resolveRecipient(input)`
```javascript
{ resolved: true, rawNumber: '12425550100', contact: {...} }
// or
{ resolved: false, reply: 'Error message to send back to owner' }
```

### `callAI(systemPrompt, userPrompt, maxTokens)`
Returns `{ text: string | null, tokens: number }`. Never throws.

### `generateMessage(intent, contact, settings, tokenLimit, purposeGuide)`
Returns `{ message: string, tokens: number }`. Falls back to template if AI fails.

### `classifyIntent(message, contact, settings)`
Returns `{ intent, confidence, kb_index, reasoning, tokens }` or `null` if AI fails.

### `saveSettings(data)`
Always reads existing settings first and merges. Safe to call from the web console without wiping operator-configured fields.

---

## How to Add a New Command
1. Add a handler block in the `message_create` listener following the existing pattern
2. Use `resolveRecipient(input)` for any command that takes a name/number
3. If it involves AI writing, call `generateMessage()` and store in `pendingPreviews`
4. Add the command to the `!help` reply string

## How to Add a New Inbound Intent
1. Add the intent string to the classifier system prompt in `classifyIntent()`
2. Add a `case 'YOUR_INTENT':` block in `handleInbound()`

## How to Add a New API Endpoint
1. Add an `if (pathname === '/api/your-endpoint')` block in the HTTP server section
2. Follow the auth pattern — check `authOk(req)` is already done above this block
3. Return JSON with `res.writeHead(200, { 'Content-Type': 'application/json' })`

---

## Deploying a New Client

1. SSH to the droplet (or provision a new one)
2. Run the one-command deploy:
   ```bash
   bash <(curl -s https://raw.githubusercontent.com/gjamescollie/OutreachBey/main/deploy.sh) \
     client_name openrouter_api_key whatsapp_number
   ```
3. Stream the QR code and scan with the client's WhatsApp (Linked Devices → Link a Device)
4. Once `🚀 ... WhatsApp Agent is live!` appears, the agent is running
5. Share the Tailscale IP + dashboard password with the client
6. Have client run `!setup` in WhatsApp to configure their business details

---

## If WhatsApp Stops Responding

1. Check logs: `docker compose logs --tail=60 outreachbey`
2. If session is corrupted: `docker compose down && rm -rf .wwebjs_auth && docker compose up -d`
3. Scan the new QR code that appears in the logs

## If Dashboard Shows No Data

- Contacts and logs live in `~/cay-cay-ai-client1/data/` on the droplet — **not in the repo**
- Copy real data from source machine: `scp ./data/contacts.csv root@<ip>:~/cay-cay-ai-client1/data/`
- No restart needed — files are read fresh on every request

---

## Current State

### Working
- All outbound commands (`!send`, `!checkin`, `!broadcast`, `!schedule`, `!sendnoai`)
- Purpose selection (5 categories) + preview → approve flow
- AI inbound classifier (14 intents, confidence-gated)
- `ON_THE_FENCE_BUYER` soft-nudge + owner review
- Hybrid opt-out (keyword fast-path + AI confirmation)
- Knowledge base (up to 40 Q&A entries) for QUESTION intents
- Setup wizard (`!setup` / `!cancelsetup`, 18 steps)
- `!followuplist` — contacts not messaged in 30+ days
- Token tracking in terminal and log.csv
- Operator console: Logs, Analytics, Contacts, Settings (4 pages)
- System health panel (WhatsApp state, memory, uptime)
- Industry KB templates (7 industries, client-side)
- Live model switching via Settings page
- Responsive design across all dashboard pages
- Docker auto-deploy via GitHub Actions on push to main

### Not Yet Built
- Windows support (`start.bat`)
- Multi-number support (Pro tier)
- `!addcontact` command
- Inbound auto-reply outside `response_window`
