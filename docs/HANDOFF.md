# OutreachBey — Handoff Guide

This document contains everything a new developer (or future-you returning after a break) needs to understand, run, and extend OutreachBey without re-reading the full conversation history.

---

## The Short Version
OutreachBey is a Node.js WhatsApp agent that:
1. Connects to WhatsApp via a linked device (QR scan, like WhatsApp Web)
2. Lets the owner send AI-written outreach messages via WhatsApp commands
3. Automatically classifies and responds to inbound messages using AI
4. Stores everything in CSV files — no database

It runs on a Mac. One instance per client. Each client has their own WhatsApp number and folder.

---

## Credentials & Keys (OutreachBey instance)
- **WhatsApp number:** 12425254093 (GJC Digital)
- **OpenRouter API key:** in `.env` as `OPENROUTER_API_KEY`
- **AI model:** `anthropic/claude-haiku-4-5` via OpenRouter
- **Calendar:** https://calendly.com/gjamescollie/30min
- **Pricing:** $49 / $129 / $299 per month

---

## Quick Start
```bash
cd '/path/to/outreachbey-agent'
npm install --ignore-scripts       # first time only
# then double-click start.command
# or:
PUPPETEER_EXECUTABLE_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" node index.js
```

---

## How to Test the AI Connection
```bash
cd '/path/to/outreachbey-agent'
node -e "
require('dotenv').config();
fetch('https://openrouter.ai/api/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + process.env.OPENROUTER_API_KEY,
    'Content-Type': 'application/json',
    'HTTP-Referer': 'https://gjcdigital.com',
    'X-Title': 'OutreachBey',
  },
  body: JSON.stringify({
    model: process.env.AI_MODEL || 'anthropic/claude-haiku-4-5',
    max_tokens: 50,
    messages: [{ role: 'user', content: 'Reply with the word WORKING' }]
  })
}).then(r => r.json()).then(d => console.log(JSON.stringify(d, null, 2))).catch(console.error);
"
```
A good response has `choices[0].message.content` containing "WORKING". An error response will have an `error` key with a message describing what's wrong (usually invalid model name or bad API key).

---

## Code Map (index.js sections in order)

| Section | What it does |
|---|---|
| `require / dotenv` | Load env vars |
| `AI_PROVIDER / AI_MODEL` | Config from .env |
| `callAI()` | Routes AI calls to correct provider, returns `{ text, tokens }` |
| `generateMessage()` | Builds system prompt from settings + contact, calls AI, returns `{ message, tokens }` |
| `generateCheckin()` | Same but for check-in messages |
| `buildTemplateFallback()` | Template-based fallback if AI fails |
| `parseCSV()` | Reads CSV files, skips comment lines |
| `appendToLog()` | Writes to log.csv |
| `updateLastContacted()` | Updates last_contacted in contacts.csv |
| `getSettings()` | Returns settings.csv as key/value object |
| `findContact()` | Looks up contact by number |
| `findContactByName()` | Looks up contacts by name (partial match) |
| `resolveRecipient()` | Accepts name or number, returns `{ resolved, rawNumber, contact }` |
| `getContactsByTag()` | Returns all contacts with a given tag |
| `getFAQAnswer()` | Keyword-based KB lookup (used for `!faq` command) |
| `getStats()` | Reads log.csv and returns counts |
| `loadFollowUps() / saveFollowUps()` | followups.json persistence |
| `pendingPreviews` | In-memory store for messages awaiting yes/no approval |
| `pendingPurpose` | In-memory store for commands awaiting purpose selection |
| `MESSAGE_PURPOSES` | 5 purpose categories with AI guidance strings |
| `SETUP_STEPS` | 18-step setup wizard definition |
| `saveSettings()` | Writes settings.csv, preserving fields not covered by setup |
| `handleSetup()` | Setup wizard state machine |
| `CLIENT SETUP` | whatsapp-web.js client initialization |
| `message_create listener` | Handles owner commands (!send, !checkin etc.) |
| `INBOUND MESSAGE HANDLER` | AI classifier + 10 intent handlers |
| `handleInbound()` | Routes inbound messages by classified intent |
| `message listener` | Fires handleInbound for non-owner incoming messages |
| `startFollowUpChecker()` | 30s interval, fires due scheduled messages |
| `client.initialize()` | Starts everything |

---

## Key Functions to Know

### `resolveRecipient(input)`
Takes a name or number string. Returns:
```javascript
{ resolved: true, rawNumber: '12425550100', contact: {...} }
// or
{ resolved: false, reply: 'Error message to send back' }
```

### `callAI(systemPrompt, userPrompt, maxTokens)`
Returns: `{ text: string | null, tokens: number }`
Never throws — returns `{ text: null, tokens: 0 }` on failure.

### `generateMessage(intent, contact, settings, tokenLimit, purposeGuide)`
Returns: `{ message: string, tokens: number }`
Falls back to template if AI fails.

### `classifyIntent(message, contact, settings)`
Returns:
```javascript
{ intent: 'DEMO', confidence: 0.95, kb_index: null, reasoning: '...', tokens: 730 }
```
Returns `null` if AI call fails or JSON can't be parsed.

### `saveSettings(data)`
Reads existing settings first, merges new values, preserves `calendar_link`, `response_window`, `token_limit_*`, and existing KB entries. Safe to call multiple times.

---

## Adding a New Command
1. Add a handler block in the `message_create` listener following the existing pattern
2. Use `resolveRecipient(input)` for any command that takes a name/number
3. If it involves AI writing, call `generateMessage()` and put result in `pendingPreviews`
4. Add the command to the `!help` reply string
5. Document it in `docs/SETUP.md`

## Adding a New Inbound Intent
1. Add the intent string to the classifier's system prompt in `classifyIntent()`
2. Add a `case 'YOUR_INTENT':` block in the switch statement in `handleInbound()`
3. Document it in `docs/SETUP.md` inbound table

## Adding a New AI Provider
1. Add a new `if (AI_PROVIDER === 'yourprovider')` block in `callAI()`
2. Follow the existing pattern — return `{ text, tokens }`
3. Add the API key to `.env` template
4. Document the model name format

---

## Current State (as of last build)

### Working
- All outbound commands with name/number lookup
- Purpose selection (5 categories)
- Preview/approval flow for !send, !checkin, !broadcast
- AI inbound classifier with 10 intent categories
- Hybrid opt-out (keyword fast-path + AI confirmation)
- 20-entry knowledge base
- Setup wizard (!setup / !cancelsetup)
- Token tracking in terminal and log.csv
- response_window in system prompts
- @c.us and @lid both handled

### Known Issues / Debug Items
- **Debug logging is still active** — `📩 Raw message event` lines print on every inbound message. Remove before production by simplifying the `message` listener (remove the console.log lines).
- **KB match for questions** — confidence can be low if the question phrasing doesn't match KB entry wording. Improve KB entries with more natural question phrasings.

### Not Yet Built
See `docs/TODO.md` for full list. Key gaps:
- Windows support
- Cloud deployment
- !addcontact command
- Multi-number (Pro tier)

---

## Deploying for a New Client
1. Copy the entire folder
2. Clear `/.wwebjs_auth/` (so it prompts for a fresh QR scan)
3. Reset `followups.json` to `[]`
4. Reset `data/log.csv` to header only
5. Update `data/contacts.csv` with client's contacts
6. Have client run `!setup` to configure their business
7. Update `.env` if using a different API key
8. Run `chmod +x start.command` on the client's machine
9. Scan QR with client's WhatsApp number

---

## File Sizes & Performance Notes
- `index.js` is ~1,340 lines — all logic in one file by design for portability
- CSV parsing reads the full file on every operation — fine for hundreds of contacts, revisit at thousands
- AI calls add 1-3 seconds latency per message — acceptable for WhatsApp
- Token cost: ~$0.001 per outbound message, ~$0.0003 per inbound classification
- 1,000 inbound messages ≈ $0.30 in AI costs
