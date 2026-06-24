# Cay AI — Setup & Operations Guide

Two deployment paths are supported. Choose one:

| Path | When to use |
|---|---|
| **Mac (local)** | Development, testing, owner running on their own machine |
| **DigitalOcean (Docker)** | Live client deployments — see [DOCKER_DEPLOY.md](DOCKER_DEPLOY.md) |

---

## Mac Setup (Local)

### Requirements
- Mac with Apple Silicon (M1/M2/M3/M4)
- Google Chrome installed at `/Applications/Google Chrome.app`
- Node.js LTS (https://nodejs.org)
- An API key from OpenRouter, Anthropic, OpenAI, or Google

### 1. Prepare the folder
```
cayai-agent/
├── index.js
├── package.json
├── start.command
├── contacts.html
├── .env                  ← copy from .env.template, fill in your key
├── followups.json        ← create containing: []
└── data/
    ├── settings.csv      ← key,value (header only to start)
    ├── contacts.csv      ← number,name,business,tags,notes,last_contacted
    └── log.csv           ← timestamp,to_number,to_name,message,status,tokens
```

### 2. Configure `.env`
Copy `.env.template` to `.env` and fill in your values:

```env
CLIENT_ID=my-business

AI_PROVIDER=openrouter
AI_MODEL=anthropic/claude-haiku-4-5
OPENROUTER_API_KEY=sk-or-v1-xxxx
```

**AI_PROVIDER options:** `openrouter` | `anthropic` | `openai` | `google`

**Recommended models (set as AI_MODEL):**

| Model | Notes |
|---|---|
| `anthropic/claude-haiku-4-5` | Fast, cheap — recommended default |
| `anthropic/claude-sonnet-4-6` | Best balance of quality and cost |
| `openai/gpt-4o-mini` | Fast and affordable |
| `google/gemini-flash-1.5` | Budget option |

### 3. Make the launcher executable (one time only)
```bash
chmod +x '/path/to/cayai-agent/start.command'
```
Tip: type `chmod +x ` then drag the file from Finder into Terminal to auto-fill the path.

### 4. Start the agent
Double-click `start.command`. First run installs dependencies automatically (`npm install --ignore-scripts`).

### 5. Scan the QR code
When the QR appears:
- WhatsApp → Settings → Linked Devices → Link a Device → Scan

Session is saved to `/.wwebjs_auth/`. QR only needed once unless you clear that folder.

### 6. Star your self-chat as a Favorite (recommended)
This keeps the owner's command channel visible while hiding customer threads:
1. Open WhatsApp → open the **"Message Yourself"** chat
2. Tap ⋮ → **Add to Favorites**
3. On WhatsApp Web, use the **Favorites** tab as the default view

### 7. Configure your business
Send `!setup` to yourself on WhatsApp and follow the 18-step wizard. Or edit `data/settings.csv` directly.

---

## Daily Use (Mac)
Double-click `start.command`. The agent reconnects without a QR scan and shows:
```
🚀 Cay AI WhatsApp Agent is live!
🤖 AI Provider: openrouter | Model: anthropic/claude-haiku-4-5
```

Keep Terminal open while running. Close it to stop.

---

## Commands

### Outbound
| Command | What it does |
|---|---|
| `!send [name/number] [intent]` | AI writes a message → purpose selection → preview → approve |
| `!schedule [name/number] [time] [intent]` | AI message sent at a specific time (e.g. `3pm`, `15:00`) |
| `!checkin [name/number]` | AI check-in tailored to contact info → preview → approve |
| `!broadcast [tag] [intent]` | AI message to all contacts with a tag → sample preview → approve |
| `!sendnoai [name/number] [message]` | Send a direct message without AI (no preview) |

### Information
| Command | What it does |
|---|---|
| `!faq [question]` | Look up an answer from the knowledge base |
| `!stats` | Messages sent today / this week / all time / unique contacts / failed |
| `!settings` | Current business name, tone, AI model, calendar link, owner number |
| `!followuplist` | Contacts not messaged in 30+ days |
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
Reply with the number. The AI adjusts tone and strategy accordingly.

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
- `inactive` — applied automatically on opt-out
- Numbers in international format, no + or spaces (e.g. `12425550100`)

---

## Inbound Handling (automatic)

The agent classifies every incoming message using AI and acts based on confidence:

| Confidence | Action |
|---|---|
| 75%+ | Auto-acts (replies, sends links, answers KB questions) |
| 45–75% | Notifies owner with suggested reply |
| Under 45% | Escalates to owner, no auto-action |

**Intent categories:**
- **Opt-out** — tags contact inactive, sends removal confirmation
- **Demo** — self-demo + calendar link
- **Call** — calendar link
- **Hot lead** — 🔥 interest reply + calendar link + urgent owner alert
- **On the fence** — soft nudge + owner review notification
- **Question** — auto-answers from knowledge base if confident
- **Complaint** — holding reply, escalates to owner (never auto-resolves)
- **Booking confirmation** — polite acknowledgement
- **Referral** — thank you + owner alert
- **Greeting** — friendly welcome
- **Other** — owner notification

**Hard opt-out triggers** (instant, no AI):
`stop messages`, `stop messaging`, `stop texting`, `stop contacting`, `unsubscribe`, `remove me from`, `opt out`

A bare "stop" does NOT trigger opt-out.

---

## Settings Reference

Edit `data/settings.csv` — changes take effect immediately, no restart needed.

| Key | Options / Notes |
|---|---|
| `business_name` | Appears in messages and notifications |
| `tone` | `friendly-pro` \| `formal` \| `casual` \| `sales` |
| `signature` | Sign-off appended to every AI message |
| `business_context` | Describes your business for the AI |
| `custom_instructions` | Extra AI rules (max 200 characters) |
| `message_length` | `short` (<50 words) \| `medium` (<80 words) \| `long` (<120 words) |
| `language_style` | `standard` \| `bahamian` \| `formal-english` |
| `response_window` | When owner is available — AI sets expectations from this |
| `calendar_link` | Calendly or any booking URL |
| `avoid_words` | Comma-separated words AI must never use |
| `faq_1_q` … `faq_20_q` | Knowledge base questions |
| `faq_1_a` … `faq_20_a` | Knowledge base answers |
| `token_limit_send` | Default 300 |
| `token_limit_checkin` | Default 150 |
| `token_limit_broadcast` | Default 250 |

---

## Switching AI Providers / Models
Edit `AI_PROVIDER` and `AI_MODEL` in `.env`. Add the matching API key. Restart the agent (or rebuild the container on Docker).

---

## Troubleshooting

### Mac
| Problem | Fix |
|---|---|
| `start.command` — no access privileges | Run `chmod +x start.command` in Terminal |
| QR appears every time | Delete `/.wwebjs_auth/` and re-scan |
| AI unavailable, template fallback used | Check `.env` API key and `AI_MODEL`. Run the API test in HANDOFF.md |
| Inbound messages not triggering | Check Terminal for `📩 Raw message event` — if absent, agent may be disconnected |
| `Cannot find module 'dotenv'` | Run `npm install --ignore-scripts` in Terminal |

### Docker
See [DOCKER_DEPLOY.md — Troubleshooting](DOCKER_DEPLOY.md#troubleshooting).

---

## Test Checklist

### Startup
- [ ] Agent starts and shows correct business name + AI provider
- [ ] `!help` returns full command list
- [ ] `!settings` shows correct business name, calendar link, model

### Outbound
- [ ] `!send [name]` resolves name correctly
- [ ] `!send [number]` works with raw number
- [ ] Purpose prompt appears (1–5)
- [ ] Each purpose produces noticeably different tone
- [ ] Preview shows before sending
- [ ] `yes` sends, `no` cancels
- [ ] `!sendnoai John Hi` sends immediately, no AI
- [ ] Unknown name returns "no contact found"

### Scheduling
- [ ] `!schedule John 3pm [intent]` confirms with ID
- [ ] `!list` shows pending message
- [ ] `!cancel [id]` removes it
- [ ] Scheduled message fires at correct time

### Broadcast
- [ ] `!broadcast lead [intent]` shows sample for approval
- [ ] `yes` sends to all tagged contacts with delay
- [ ] `no` cancels cleanly

### Inbound (test from second phone)
- [ ] "I want a demo" → demo response + calendar link
- [ ] "can we book a call" → calendar link
- [ ] "how much does this cost" → hot lead response
- [ ] "what are your hours" → auto-answers from KB
- [ ] "this isn't working" → complaint holding reply + owner alert
- [ ] "my friend needs this" → referral thank you + owner alert
- [ ] "hi there" → greeting
- [ ] "stop messages" → opt-out confirmation
- [ ] "stop" (alone) → NOT an opt-out

### Safety
- [ ] Messaging agent from own phone → no auto-reply loop
- [ ] Group message → agent ignores it
- [ ] Opt-out → contact tagged `inactive` in contacts.csv
- [ ] `!setup` re-run → calendar link and token limits preserved

### Docker-specific
- [ ] `curl http://<droplet-ip>:3000/health` returns `{ status: "ok", ... }`
- [ ] Container auto-restarts after `docker kill <container>`
- [ ] Data survives `docker compose down && docker compose up -d`
- [ ] Proxy IP confirmed: `curl --proxy $PROXY_URL https://ifconfig.me` returns residential IP
