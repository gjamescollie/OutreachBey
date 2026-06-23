# Cay AI — Future Plans

## Immediate (before using with real clients)

- [x] **Remove debug logging from inbound listener** — stripped from `index.js`.
- [ ] **Test all 20 KB entries** — run through the comprehensive test plan in SETUP.md section 6 to confirm each FAQ auto-answers correctly at 75%+ confidence.
- [ ] **Fill in real Cay AI answers in settings.csv** — some entries still have placeholder-quality answers. Review and sharpen each one.
- [ ] **Test !setup wizard end-to-end** — run `!setup`, complete all 18 steps, and confirm settings.csv is written correctly without wiping calendar link or token settings.
- [ ] **Test re-running !setup** — confirm it preserves `calendar_link`, `response_window`, and token limits from the existing file.

---

## Short Term (first client deployment)

- [x] **`ON_THE_FENCE_BUYER` intent** — detects warm prospects who are curious but undecided. Sends Cialdini-style soft-nudge auto-reply, sets stage to `exploring`, and notifies owner for follow-up.
- [ ] **Windows support** — create `start.bat` equivalent of `start.command` so the agent can run on Windows machines. Same logic, different shell syntax.
- [ ] **`!addcontact` command** — add a contact directly from WhatsApp: `!addcontact 12425550100 John Smith | Smith Hardware | lead | Met at networking event`. Pure logic, no AI. Uses `|` separator to avoid CSV comma conflicts.
- [x] **`!followuplist` command** — scans `last_contacted` in contacts.csv and returns everyone not messaged in 30+ days. Relationship maintenance prompt for the owner.
- [x] **Strip debug logs** — done.
- [ ] **Client onboarding template** — a blank `settings.csv` with clear instructions per field, ready to hand to a new client.

---

## Medium Term (scaling to multiple clients)

- [ ] **Cloud deployment** — move from local Mac to a cloud server (Railway or a cheap VPS) for 24/7 uptime. The agent should auto-restart on crash. Target: Pro tier clients first.
- [ ] **UptimeRobot integration** — for Starter/Growth clients still on Mac/Replit, set up UptimeRobot pings to keep the process alive.
- [ ] **Operator monitoring dashboard** — a simple status page or spreadsheet showing which client agents are running, last active, message counts, and any errors. Even a shared Google Sheet works for now.
- [ ] **Per-client logging** — currently all logs go to `data/log.csv` in each instance. For operator visibility, aggregate logs across clients.
- [ ] **`!stats` improvements** — add weekly/monthly breakdowns, top contacted numbers, and intent breakdown from inbound log.

---

## Product Roadmap

- [ ] **Multi-number support (Pro tier)** — run the agent across multiple WhatsApp numbers from a single instance. Required for larger businesses with dedicated sales/support lines.
- [ ] **Image and file sending** — whatsapp-web.js supports media. Add `!sendimage` and `!sendfile` commands for sending product photos, menus, price lists etc.
- [ ] **`!draft` / `!unsaved`** — save a message draft without sending, come back to it later.
- [ ] **`!remind [name] [date] [intent]`** — schedule by date not just time. Useful for birthdays, contract renewals, follow-up after a quoted project.
- [ ] **OpenRouter model picker in settings** — allow clients to change their AI model from `settings.csv` without touching `.env`. Operator controls the key, client controls the model tier.
- [ ] **Inbound auto-reply outside response_window** — if a message arrives outside `response_window`, auto-reply with "We are currently closed, we will get back to you during business hours" using the response_window value.
- [ ] **Contacts HTML improvements** — add import CSV, tag filtering, and last_contacted display. Currently export-only.
- [ ] **`!quote [name] [service] [amount]`** — AI writes a professional price quote message. High value for service businesses in Nassau.

---

## Nice to Have (future)

- [ ] **Multi-language support** — Bahamian Creole, Spanish for tourist-facing businesses
- [ ] **Webhook/Zapier integration** — trigger agent actions from external tools
- [ ] **CRM sync** — Zoho, Airtable, or HubSpot integration as an upgrade from CSV
- [ ] **Conversation history context** — pass recent message history to AI so follow-ups reference prior exchanges
- [ ] **Analytics dashboard** — web UI showing send/receive rates, intent breakdown, response times, hot lead conversion
- [ ] **Email digest** — send `review.html` content as a formatted HTML email via Resend or SendGrid (free tier, one `fetch()` call, no npm dependency). Add `OUTREACH_EMAIL_KEY` to `.env`. Complements `review.html` with push delivery on Sundays.
