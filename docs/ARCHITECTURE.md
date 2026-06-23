# OutreachBey — Architecture

## Stack
- **Runtime:** Node.js v18+ (tested on v24)
- **WhatsApp layer:** whatsapp-web.js (linked device via Puppeteer)
- **Browser:** System Google Chrome (not Puppeteer's bundled Chrome)
- **AI:** OpenRouter API (default model: `anthropic/claude-haiku-4-5`)
- **Storage:** CSV files (no database)
- **Config:** `.env` file

## File Structure
```
outreachbey-agent/
├── index.js              ← All agent logic
├── package.json          ← Dependencies
├── start.command         ← Mac double-click launcher
├── contacts.html         ← Local browser-based contact manager
├── .env                  ← API keys and provider config (never commit)
├── followups.json        ← Scheduled messages (auto-managed)
└── data/
    ├── settings.csv      ← Business config, tone, KB, token limits
    ├── contacts.csv      ← Contact list
    └── log.csv           ← All messages sent and received with tokens
```

## WhatsApp Connection
- Uses `whatsapp-web.js` with `LocalAuth` — session persists after first QR scan
- Connects as a **linked device** (like WhatsApp Web), not the Meta Cloud API
- This avoids phone number verification requirements but is technically against WhatsApp ToS
- Two event listeners:
  - `message_create` — fires on messages the **owner sends** (command interface)
  - `message` — fires on messages **received from contacts** (inbound handler)
- Both `@c.us` and `@lid` sender formats are supported (WhatsApp changed format for some accounts)

## AI Layer
All AI calls go through `callAI(systemPrompt, userPrompt, maxTokens)` which routes based on `AI_PROVIDER` in `.env`:
- `openrouter` — OpenRouter API (recommended, supports all models)
- `anthropic` — Anthropic API direct
- `openai` — OpenAI API direct
- `google` — Google Gemini API direct

Model is set via `AI_MODEL` in `.env`. Every call returns `{ text, tokens }` and logs token usage to terminal and `log.csv`.

### Token Limits (configurable in settings.csv)
| Setting | Default | Used for |
|---|---|---|
| `token_limit_send` | 300 | !send, !schedule outbound messages |
| `token_limit_checkin` | 150 | !checkin messages |
| `token_limit_broadcast` | 250 | !broadcast per-contact messages |
| Classifier (hardcoded) | 150 | Inbound intent classification |

## Inbound Message Flow
```
Contact sends message
        ↓
Hard opt-out keyword check (instant, no AI)
  → "stop messages", "unsubscribe" etc.
        ↓
AI Intent Classifier (classifyIntent)
  → Returns: { intent, confidence, kb_index, reasoning }
        ↓
Confidence gate:
  < 0.45  → escalate to owner, no auto-action
  0.45-0.75 → notify owner with suggested reply
  > 0.75  → act automatically
        ↓
Route by intent:
  OPT_OUT | DEMO | CALL | HOT_LEAD | QUESTION
  COMPLAINT | BOOKING_CONFIRMATION | REFERRAL | GREETING | OTHER
```

### Confidence Thresholds
```javascript
const AUTO_ACT_THRESHOLD = 0.75;  // above this → auto-act
const SUGGEST_THRESHOLD  = 0.45;  // below this → always escalate
```

## Outbound Message Flow
```
Owner sends !send John follow up on proposal
        ↓
Resolve recipient (name or number lookup)
        ↓
Ask purpose (1-5 categories)
        ↓
AI generates message with:
  - Contact name, business, notes
  - Business context + custom instructions
  - Tone + language style + response_window
  - Message length + avoid_words
  - Purpose guide
        ↓
Show preview → owner approves with "yes" / "no"
        ↓
Send + log + update last_contacted
```

## CSV Schema

### settings.csv
```
key,value
business_name, owner_number, tone, signature
business_context, custom_instructions, message_length, language_style, avoid_words
response_window
calendar_link
token_limit_send, token_limit_checkin, token_limit_broadcast
faq_1_q, faq_1_a ... faq_20_q, faq_20_a
```
Comment lines starting with `#` are ignored by the parser.

### contacts.csv
```
number, name, business, tags, notes, last_contacted
```
Tags are used for `!broadcast [tag]`. Reserved tag: `inactive` (opt-out).

### log.csv
```
timestamp, to_number, to_name, message, status, tokens
```
Status values: `sent`, `received`, `auto-replied`, `opt-out`, `hot-lead`, `demo`, `call`, `complaint`, `booking`, `referral`, `greeting`, `needs-reply`, `unhandled`, `possible-opt-out`

## Mac-Specific Setup
- Chrome path hardcoded: `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`
- `start.command` is a bash launcher that handles dependencies, quarantine flags, and Chrome path
- Must run `chmod +x start.command` after each fresh download
- `npm install --ignore-scripts` prevents Puppeteer from downloading its own Chrome

## Known Limitations
- Single WhatsApp number per instance (Pro tier will support multi-number)
- Agent must stay running (Mac must stay awake, Terminal open)
- No Windows support yet (`start.bat` needed)
- No cloud deployment yet (planned)
- followups.json is in-memory + file — survives restarts but not corruption
