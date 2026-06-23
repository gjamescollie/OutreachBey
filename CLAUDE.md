# Cay AI — Claude Code Project Brief

## What This Is
Cay AI is a Node.js WhatsApp AI outreach agent for small businesses in Nassau, Bahamas. It is a managed SaaS product built and operated by Lucayan Labs (Granville). Each client gets their own instance connected to their own WhatsApp number.

The agent does two things:
1. Lets the business owner send AI-written WhatsApp messages via `!commands` from their own phone
2. Automatically classifies and responds to inbound customer messages using AI

**This is not a web app. There is no server, no dashboard, no database.** It runs locally on a Mac, connects to WhatsApp via linked device (QR scan), and stores everything in CSV files.

---

## Stack
- **Runtime:** Node.js v18+
- **WhatsApp:** whatsapp-web.js (linked device via Puppeteer, NOT Meta Cloud API)
- **Browser:** System Google Chrome — hardcoded path `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`
- **AI:** OpenRouter API (default model: `anthropic/claude-haiku-4-5`) — also supports Anthropic, OpenAI, Google direct
- **Storage:** CSV files only — no database
- **Config:** `.env` file

---

## File Structure
```
cayai-agent/
├── index.js              ← ALL agent logic — ~1,340 lines, one file by design
├── package.json
├── start.command         ← Mac double-click launcher
├── contacts.html         ← Local browser-based contact manager
├── CLAUDE.md             ← This file
├── .env                  ← API keys (never commit)
├── followups.json        ← Scheduled messages (auto-managed)
└── data/
    ├── settings.csv      ← Business config, tone, KB, token limits
    ├── contacts.csv      ← Contact list
    └── log.csv           ← All messages sent/received with tokens
```

**One file by design.** Do not split `index.js` into modules. Portability is a core product requirement — each client deployment is a single folder that gets copied. Keep all logic in `index.js`.

---

## index.js — Section Map (in order)
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
| `getStats()` | Reads log.csv, returns counts |
| `loadFollowUps() / saveFollowUps()` | followups.json persistence |
| `pendingPreviews` | In-memory store for messages awaiting yes/no approval |
| `pendingPurpose` | In-memory store for commands awaiting purpose selection |
| `MESSAGE_PURPOSES` | 5 purpose categories with AI guidance strings |
| `SETUP_STEPS` | 18-step setup wizard definition |
| `saveSettings()` | Writes settings.csv, preserving fields not in setup wizard |
| `handleSetup()` | Setup wizard state machine |
| `CLIENT SETUP` | whatsapp-web.js client initialization |
| `message listener` | Inbound handler — fires handleInbound() for customer messages |
| `message_create listener` | Owner command handler — !send, !checkin, !broadcast etc. |
| `handleBroadcastApproval()` | Loops through contacts and sends broadcast |
| `startFollowUpChecker()` | 30s interval, fires due scheduled messages |
| `classifyIntent()` | AI intent classifier — returns `{ intent, confidence, kb_index, reasoning }` |
| `handleInbound()` | Routes inbound messages by classified intent |
| `client.initialize()` | Starts everything |

---

## Key Functions — Know These Before Touching Anything

### `resolveRecipient(input)`
Accepts a name string or phone number. Returns:
```javascript
{ resolved: true, rawNumber: '12425550100', contact: {...} }
// or
{ resolved: false, reply: 'Error message to send back to owner' }
```
Use this in every command that takes a name/number argument.

### `callAI(systemPrompt, userPrompt, maxTokens)`
Returns `{ text: string | null, tokens: number }`. Never throws — returns `{ text: null, tokens: 0 }` on failure. Every AI call goes through this function.

### `generateMessage(intent, contact, settings, tokenLimit, purposeGuide)`
Returns `{ message: string, tokens: number }`. Falls back to template if AI fails. Builds the full system prompt from settings — tone, language, signature, avoid_words, response_window, custom_instructions.

### `classifyIntent(message, contact, settings)`
Returns `{ intent, confidence, kb_index, reasoning, tokens }` or `null` if AI fails.

Confidence thresholds:
- `>= 0.75` → auto-act
- `0.45–0.75` → notify owner with suggestion
- `< 0.45` → escalate, no auto-action

### `saveSettings(data)`
Always reads existing settings first and merges. Preserves `calendar_link`, `response_window`, `token_limit_*`, and `avoid_words` even if not passed in. Safe to call from setup wizard without wiping operator-configured fields.

---

## CSV Schema

### settings.csv
```
key,value
business_name, owner_number, tone, signature
business_context, custom_instructions, message_length, language_style, avoid_words
response_window, calendar_link
token_limit_send, token_limit_checkin, token_limit_broadcast
faq_1_q, faq_1_a ... faq_20_q, faq_20_a
```
Comment lines starting with `#` are ignored by the parser. Settings are read fresh on every operation — no restart needed after edits.

### contacts.csv
```
number, name, business, tags, notes, last_contacted
```
- Numbers in international format, no + or spaces (e.g. `12425550100`)
- `tags` used for `!broadcast [tag]`
- `inactive` tag = opted out, agent will not message them

### log.csv
```
timestamp, to_number, to_name, message, status, tokens
```

---

## Inbound Message Flow
```
Contact sends message
  → Hard opt-out keyword check (instant, no AI)
  → AI classifyIntent() — returns intent + confidence
  → Confidence gate (0.45 / 0.75 thresholds)
  → Route by intent: OPT_OUT | DEMO | CALL | HOT_LEAD | ON_THE_FENCE_BUYER
                     QUESTION | COMPLAINT | BOOKING_CONFIRMATION | REFERRAL
                     GREETING | ACKNOWLEDGEMENT | CONVERSATION_CONTINUATION
                     PERSONAL_CONVERSATION | WRONG_NUMBER | OTHER
```

**Hard opt-out keywords** (bypass AI entirely):
`stop messages`, `stop messaging`, `stop texting`, `stop contacting`, `unsubscribe`, `remove me from`, `opt out`

A bare "stop" does NOT trigger opt-out — intentional, to avoid accidental funnel drop-off.

---

## Outbound Command Flow
```
Owner sends !send John follow up on proposal
  → resolveRecipient() — name or number lookup
  → PURPOSE_PROMPT sent to owner (1-5 categories)
  → Owner replies with number
  → generateMessage() called with purpose guide
  → Preview shown to owner
  → Owner replies yes / no
  → Send + log + updateLastContacted()
```

---

## AI Writing Rules (hardcoded into every prompt)
- 9th grade reading level
- Max 1 emoji per message
- No hashtags
- No subject lines
- Sign off with exactly the `signature` value from settings
- Never reveal the message was written by AI
- Never imply instant human response outside `response_window`
- Never use words in `avoid_words` field
- `custom_instructions` field adds extra rules (max 200 chars)

**Tone options:** `friendly-pro` (default), `formal`, `casual`, `sales`
**Message length:** `short` (<50 words), `medium` (<80 words), `long` (<120 words)
**Language style:** `standard`, `bahamian`, `formal-english`

---

## Current State

### Working
- All outbound commands (`!send`, `!checkin`, `!broadcast`, `!schedule`, `!sendnoai`)
- Purpose selection (5 categories) with per-purpose AI tone variation
- Preview → approve flow for all outbound messages
- AI inbound classifier (10 intents, hybrid keyword + AI, confidence-gated)
- `ON_THE_FENCE_BUYER` intent — soft-nudge auto-reply + owner review notification
- Hybrid opt-out (keyword fast-path + AI soft-opt-out confirmation)
- 20-entry knowledge base for auto-answering QUESTION intents
- Setup wizard (`!setup` / `!cancelsetup`, 18 steps)
- `!followuplist` command (contacts not messaged in 30+ days)
- Session inactivity checker (nudge at 5 min, expire at 10 min) for demo, setup, and add-contact wizards
- Token tracking in terminal and log.csv
- `response_window` wired into AI prompts
- Both `@c.us` and `@lid` WhatsApp sender formats handled
- Debug logging removed from inbound listener

### Known Issues
- KB match confidence can be low if question phrasing doesn't match KB entry wording — improve by writing KB questions in natural customer language

### Future Plans
- `!addcontact` command
- Windows support (`start.bat`)
- Cloud deployment
- Multi-number support (Pro tier)
- Inbound auto-reply outside `response_window`

---

## How to Add a New Command
1. Add a handler block in the `message_create` listener, following the existing pattern
2. Use `resolveRecipient(input)` for any command that takes a name/number
3. If it involves AI writing, call `generateMessage()` and store result in `pendingPreviews`
4. Add the command to the `!help` reply string
5. Update `docs/SETUP.md`

## How to Add a New Inbound Intent
1. Add the intent string to the classifier system prompt in `classifyIntent()`
2. Add a `case 'YOUR_INTENT':` block in the switch statement in `handleInbound()`
3. Update `docs/SETUP.md`

---

## Deploying for a New Client
1. Copy the entire folder
2. Clear `/.wwebjs_auth/` (fresh QR scan)
3. Reset `followups.json` to `[]`
4. Reset `data/log.csv` to header only: `timestamp,to_number,to_name,message,status,tokens`
5. Update `data/contacts.csv` with client's contacts
6. Have client run `!setup` on WhatsApp to configure their business
7. Update `.env` if using a different API key
8. Run `chmod +x start.command` on the client's machine
9. Scan QR with client's WhatsApp number

---

## Performance & Cost Notes
- CSV parsing reads the full file on every operation — fine for hundreds of contacts
- AI calls add 1–3 seconds latency — acceptable for WhatsApp
- Token cost: ~$0.001 per outbound message, ~$0.0003 per inbound classification
- 1,000 inbound messages ≈ $0.30 in AI costs

---

## What Never To Do
- Do not split index.js into multiple files
- Do not add a database dependency
- Do not add a web server or dashboard (not in scope)
- Do not auto-send any message without owner preview and approval (except auto-replies to inbound)
- Do not resolve a complaint automatically — always route to human
- Do not trigger opt-out on a bare "stop" — requires multi-word phrase
- Do not commit `.env` or `/.wwebjs_auth/`
