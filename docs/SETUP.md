# OutreachBey — Setup & Operations Guide

## Requirements
- Mac with Apple Silicon (M1/M2/M3/M4)
- Google Chrome installed at `/Applications/Google Chrome.app`
- Node.js LTS installed (https://nodejs.org)
- An OpenRouter API key (https://openrouter.ai) or Anthropic/OpenAI/Google key

---

## First-Time Setup

### 1. Prepare the folder
```
outreachbey-agent/
├── index.js
├── package.json
├── start.command
├── contacts.html
├── .env
├── followups.json        ← create this as an empty file containing: []
└── data/
    ├── settings.csv
    ← contacts.csv
    └── log.csv           ← create with header: timestamp,to_number,to_name,message,status,tokens
```

### 2. Configure your API key
Open `.env` and set:
```
AI_PROVIDER=openrouter
AI_MODEL=anthropic/claude-haiku-4-5
OPENROUTER_API_KEY=your-key-here
```

Available models (paste into AI_MODEL):
- `anthropic/claude-haiku-4-5` — fast, cheap, recommended default
- `anthropic/claude-sonnet-4-6` — best balance of quality and cost
- `anthropic/claude-opus-4-6` — highest quality
- `openai/gpt-4o-mini` — fast and affordable
- `google/gemini-flash-1.5` — budget option

### 3. Make the launcher executable (one time per new download)
```bash
chmod +x '/path/to/outreachbey-agent/start.command'
```
Tip: type `chmod +x ` then drag the file from Finder into Terminal to auto-fill the path.

### 4. Start the agent
Double-click `start.command`. First run installs dependencies automatically (`npm install --ignore-scripts`).

### 5. Scan the QR code
When the QR code appears:
- Open WhatsApp → Settings → Linked Devices → Link a Device → Scan

Session is saved. QR scan is only needed once unless you log out or clear `/.wwebjs_auth/`.

### 6. Star the self-chat as a Favorite (recommended)
So the owner remembers to route everything through the bot instead of replying to customers directly:
1. Open WhatsApp (phone or Web) → open the **"Message Yourself"** chat (the one the bot reads commands from)
2. Tap/click **⋮** (or right-click on Web) → **Add to Favorites**
3. On WhatsApp Web, use the **Favorites** tab instead of "All" as the default view

This filters the chat list down to just the starred chat(s) — customer threads and other clutter disappear from view, making it much easier to stick to the bot's command flow instead of accidentally replying to a customer directly (which bypasses logging and the approval flow).

### 7. Configure your business
Send yourself `!setup` on WhatsApp and follow the 18-step wizard:
- Business name, owner number, business context
- Tone, message length, language style
- Signature, custom instructions
- 10 knowledge base entries (answers only — questions are pre-filled)

Or edit `data/settings.csv` directly.

---

## Starting the Agent (Daily Use)
Double-click `start.command`. The agent will reconnect without a QR scan and show:
```
🚀 OutreachBey WhatsApp Agent is live!
🤖 AI Provider: openrouter | Model: anthropic/claude-haiku-4-5
```

Keep the Terminal window open while running. Close it to stop the agent.

---

## Commands (send to yourself on WhatsApp)

### Outbound
| Command | What it does |
|---|---|
| `!send [name/number] [intent]` | AI writes a message → purpose selection → preview → approve |
| `!schedule [name/number] [time] [intent]` | AI message sent at a specific time (e.g. 3pm, 15:00) |
| `!checkin [name/number]` | AI check-in tailored to contact info → preview → approve |
| `!broadcast [tag] [intent]` | AI message to all contacts with a tag → sample preview → approve |
| `!sendnoai [name/number] [message]` | Send a direct message without AI (no preview) |

### Information
| Command | What it does |
|---|---|
| `!faq [question]` | Look up an answer from the knowledge base |
| `!stats` | Messages sent today / this week / all time / unique contacts / failed |
| `!settings` | Current business name, tone, AI model, calendar link, owner number |
| `!list` | All pending scheduled messages with IDs and times |
| `!help` | Full command list |

### Management
| Command | What it does |
|---|---|
| `!cancel [id]` | Cancel a scheduled message by ID |
| `!setup` | Run the interactive setup wizard |
| `!cancelsetup` | Cancel setup wizard without saving |

### Approvals
After `!send`, `!checkin`, or `!broadcast` shows a preview:
- Reply `yes` → sends the message
- Reply `no` → cancels

---

## Purpose Categories
Every `!send`, `!schedule`, and `!checkin` asks for a purpose:
```
1️⃣ Sales & Outreach
2️⃣ Follow Up
3️⃣ Relationship
4️⃣ Information
5️⃣ Support
```
Reply with the number. The AI adjusts tone and messaging strategy accordingly.

---

## Managing Contacts

### Browser UI (recommended)
Open `contacts.html` in any browser. Add, search, delete. Click **Export CSV** and replace `data/contacts.csv`.

### Direct CSV edit
Open `data/contacts.csv` in Excel or Numbers. Columns:
```
number, name, business, tags, notes, last_contacted
```
- `tags` — used for `!broadcast`. Common values: `lead`, `client`, `prospect`, `vip`, `inactive`
- `inactive` — tag applied automatically on opt-out
- Numbers in international format, no + or spaces (e.g. `12425550100`)

---

## Inbound Handling (automatic)

The agent classifies every incoming message using AI and acts based on confidence:

| Confidence | Action |
|---|---|
| 75%+ | Auto-acts (replies, sends links, answers KB questions) |
| 45-75% | Notifies owner with suggested reply |
| Under 45% | Escalates to owner, no auto-action |

**Intent categories:**
- **Opt-out** — tags contact inactive, sends removal confirmation
- **Demo** — self-demo + calendar link
- **Call** — calendar link
- **Hot lead** — 🔥 interest reply + calendar link + urgent owner alert
- **Question** — auto-answers from knowledge base if confident
- **Complaint** — holding reply, escalates to owner (never auto-resolves)
- **Booking confirmation** — polite acknowledgement
- **Referral** — thank you + owner alert
- **Greeting** — friendly welcome
- **Other** — owner notification

**Opt-out triggers** (instant, no AI):
`stop messages`, `stop messaging`, `stop texting`, `stop contacting`, `unsubscribe`, `remove me from`, `opt out`

A bare "stop" does NOT trigger opt-out.

---

## Updating Settings
Edit `data/settings.csv` — changes take effect immediately, no restart needed.

Key fields:
- `business_name` — appears in messages and notifications
- `tone` — `friendly-pro` | `formal` | `casual` | `sales`
- `signature` — sign-off on all messages
- `business_context` — describes your business for the AI
- `custom_instructions` — extra AI rules (max 200 characters)
- `message_length` — `short` | `medium` | `long`
- `language_style` — `standard` | `bahamian` | `formal-english`
- `response_window` — when owner is available (AI uses this to set expectations)
- `calendar_link` — Calendly or any booking link
- `avoid_words` — comma-separated words AI must never use
- `faq_1_q` to `faq_20_q` / `faq_1_a` to `faq_20_a` — knowledge base

---

## Switching AI Models
Edit `AI_MODEL` in `.env`. See model list in step 2 above. Restart the agent after changing `.env`.

## Switching AI Providers
Edit `AI_PROVIDER` in `.env` to `openrouter`, `anthropic`, `openai`, or `google`. Add the corresponding API key. Restart agent.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `start.command` — no appropriate access privileges | Run `chmod +x start.command` in Terminal |
| QR code appears every time | Delete `/.wwebjs_auth/` folder and re-scan |
| AI unavailable, using template fallback | Check `.env` API key and `AI_MODEL` name. Run the direct API test in HANDOFF.md |
| Inbound messages not triggering | Check Terminal for `📩 Raw message event` — if showing `@lid` suffix, code handles it. If not showing at all, agent may be disconnected |
| `Cannot find module 'dotenv'` | Run `npm install --ignore-scripts` in Terminal |

---

## Comprehensive Test Checklist

### Startup
- [ ] Agent starts and shows correct business name + AI provider
- [ ] `!help` returns full command list
- [ ] `!settings` shows correct business name, calendar link, model

### Outbound
- [ ] `!send [name]` resolves name correctly
- [ ] `!send [number]` works with raw number
- [ ] Purpose prompt appears (1-5)
- [ ] Each purpose produces noticeably different tone
- [ ] Preview shows before sending
- [ ] `yes` sends, `no` cancels
- [ ] `!sendnoai John Hi` sends immediately with no AI
- [ ] Unknown name returns "no contact found"
- [ ] Ambiguous name lists matches and asks for number

### Scheduling
- [ ] `!schedule John 3pm [intent]` confirms with ID
- [ ] `!list` shows pending message
- [ ] `!cancel [id]` removes it
- [ ] Scheduled message fires at correct time
- [ ] Owner gets "sent" notification when fired

### Broadcast
- [ ] `!broadcast lead [intent]` shows sample for approval
- [ ] `yes` sends to all tagged contacts with delay
- [ ] `no` cancels cleanly

### Inbound (test from second phone)
- [ ] "I want a demo" → demo response + calendar link
- [ ] "can we book a call" → calendar link
- [ ] "how much does this cost" → hot lead response
- [ ] "what are your hours" → auto-answers from KB
- [ ] "what is outreachbey" → auto-answers from KB
- [ ] "this isn't working" → complaint holding reply + owner alert
- [ ] "my friend needs this" → referral thank you + owner alert
- [ ] "hi there" → greeting
- [ ] "stop messages" → opt-out confirmation
- [ ] "stop" (alone) → NOT an opt-out
- [ ] Random gibberish → escalates to owner

### Safety
- [ ] Messaging agent from own phone → no auto-reply loop
- [ ] Group message → agent ignores it
- [ ] Opt-out → contact tagged `inactive` in contacts.csv
- [ ] `!setup` re-run → calendar link and tokens preserved

### Logs
- [ ] `data/log.csv` populates with sent messages + tokens
- [ ] Inbound messages logged with intent
- [ ] `!stats` returns accurate counts
