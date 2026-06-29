# Cay AI — Architecture

## Stack
- **Runtime:** Node.js v18+
- **WhatsApp layer:** whatsapp-web.js (linked device via Puppeteer)
- **Browser (Mac):** System Google Chrome — hardcoded path `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`
- **Browser (Docker):** Chromium installed in container — path set via `PUPPETEER_EXECUTABLE_PATH`
- **AI:** OpenRouter API (default model: `anthropic/claude-haiku-4-5`) — also supports Anthropic, OpenAI, Google direct
- **Storage:** CSV files only — no database
- **Config:** `.env` file

## File Structure
```
OutreachBey/
├── index.js              ← ALL agent + server logic (~3,800 lines, one file by design)
├── package.json
├── logs.html             ← Operator console: live logs + system health
├── analytics.html        ← Operator console: ROI + analytics
├── contacts.html         ← Operator console: contact manager CRM
├── settings.html         ← Operator console: settings + KB editor
├── Dockerfile
├── docker-compose.yml
├── entrypoint.sh         ← Seeds data/ on first run, clears Chromium locks, starts agent
├── deploy.sh             ← One-command droplet provisioner
├── .github/workflows/deploy.yml  ← Auto-deploys to droplet on push to main
├── defaults/             ← Template settings.csv for new client onboarding
├── demo/                 ← Industry demo personas (settings + KB) for live demos
├── docs/                 ← Architecture, project, handoff, decisions
├── tests/                ← index.test.js
├── .env                  ← API keys + DASHBOARD_PASSWORD (never commit)
├── followups.json        ← Scheduled messages (volume-mounted, not in repo)
└── data/                 ← Volume-mounted, never committed
    ├── settings.csv      ← Business config, tone, KB, token limits
    ├── contacts.csv      ← Contact list
    └── log.csv           ← All messages sent/received with tokens
```

**One file by design.** Do not split `index.js` into modules. Portability is a core product requirement — each client deployment is a single folder.

## Operator Console
Static HTML files served by the Node.js HTTP server on `:3000`. Auth is a single session cookie (`dash_session`) checked on every request. Pages fetch data from `/api/*` JSON endpoints.

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/logs` | GET | Paginated log entries + system health (waState, memMB, uptime) |
| `/api/analytics` | GET | Aggregated stats for a day range |
| `/api/contacts` | GET/POST | Read or write contacts.csv |
| `/api/settings` | GET/POST | Read or write settings.csv + KB |
| `/api/followups` | GET | List scheduled messages |
| `/api/followups/cancel` | POST | Cancel a scheduled message |
| `/api/model` | POST | Switch AI model live (no restart) |
| `/health` | GET | No-auth health check |

## WhatsApp Connection
- Uses `whatsapp-web.js` with `LocalAuth` — session persists after first QR scan in `.wwebjs_auth/`
- Connects as a **linked device** (like WhatsApp Web), not the Meta Cloud API
- Both `@c.us` and `@lid` sender formats are handled
- `waState` variable tracks connection: `'connecting'` → `'connected'` (on ready) → `'disconnected'` (on disconnect)
- Auto-reconnect: up to 3 attempts with 5s/10s/15s delays

## AI Layer
All AI calls go through `callAI(systemPrompt, userPrompt, maxTokens)` which routes based on `AI_PROVIDER` in `.env`:
- `openrouter` — OpenRouter API (recommended, supports all models)
- `anthropic` — Anthropic API direct
- `openai` — OpenAI API direct
- `google` — Google Gemini API direct

Model is switchable live via the Settings page (calls `POST /api/model`) without restart. Returns `{ text, tokens }` — never throws.

### Token Limits (configurable in Settings)
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
  "stop messages", "unsubscribe", "remove me from" etc.
        ↓
AI Intent Classifier → { intent, confidence, kb_index, reasoning }
        ↓
Confidence gate:
  < 0.45  → escalate to owner, no auto-action
  0.45–0.75 → notify owner with suggested reply
  > 0.75  → act automatically
        ↓
Route by intent:
  OPT_OUT | DEMO | CALL | HOT_LEAD | ON_THE_FENCE_BUYER
  QUESTION | COMPLAINT | BOOKING_CONFIRMATION | REFERRAL
  GREETING | ACKNOWLEDGEMENT | CONVERSATION_CONTINUATION
  PERSONAL_CONVERSATION | WRONG_NUMBER | OTHER
```

## Outbound Message Flow
```
Owner sends !send John follow up on proposal
        ↓
resolveRecipient() — name or number lookup
        ↓
PURPOSE_PROMPT sent to owner (5 categories)
        ↓
generateMessage() with contact + purpose + settings
        ↓
Preview shown to owner → "yes" / "no"
        ↓
Send + log + updateLastContacted()
```

## CSV Schema

### settings.csv
```
key,value
business_name, owner_number, tone, signature
business_context, custom_instructions, message_length, language_style, avoid_words
response_window, calendar_link, control_channel, ai_model
token_limit_send, token_limit_checkin, token_limit_broadcast
faq_1_q, faq_1_a ... faq_40_q, faq_40_a
```

### contacts.csv
```
number, name, business, tags, notes, last_contacted, email, industry
```
- Numbers in international format, no `+` or spaces (`12425550100`)
- `tags` space-separated: `lead`, `client`, `vip`, `inactive`, `stage:demo` etc.
- `inactive` tag = opted out — agent will not message them

### log.csv
```
timestamp, to_number, to_name, message, status, tokens, confidence, direction, command
```
Status values: `inbound`, `outbound`, `auto-reply`, `opt-out`, `demo`, `owner`, `outside`, `escalated` etc.

## Docker Deployment

Each client runs as an isolated Docker container on a DigitalOcean droplet ($6/mo).

### Container volume mounts
| Path in container | Host path | Purpose |
|---|---|---|
| `/app/data/` | `./data/` | Settings, contacts, log CSV |
| `/app/.wwebjs_auth/` | `./.wwebjs_auth/` | WhatsApp session (delete to re-scan QR) |
| `/app/followups.json` | `./followups.json` | Scheduled messages |

### Key environment variables
| Variable | Purpose |
|---|---|
| `DASHBOARD_PASSWORD` | Required — gates the operator console |
| `CLIENT_ID` | Human-readable client name shown in `/health` |
| `AI_PROVIDER` | `openrouter` \| `anthropic` \| `openai` \| `google` |
| `AI_MODEL` | Model string passed to provider |
| `IS_DOCKER` | Set by docker-compose — switches Chrome to Chromium path |
| `PUPPETEER_EXECUTABLE_PATH` | Full path to Chromium binary in container |
| `PROXY_URL` | Optional residential proxy for WhatsApp connection |

### Auto-deploy
Push to `main` → GitHub Actions SSHs to droplet → `git pull` → `docker compose build --no-cache` → `docker compose up -d`

## Known Limitations
- Single WhatsApp number per instance (Pro tier: multi-number)
- No Windows support (no `start.bat`)
- CSV parsing reads full file on every operation — fine for hundreds of contacts, revisit at thousands
