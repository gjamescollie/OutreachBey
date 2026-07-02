# Cay AI — Working TODO

> **Governing document:** `docs/SCOPE_OF_WORK.md` (SOW v1.1 — Lucayan Labs, June 2026)
> This file tracks build status against the SOW. Update it as items ship.
> North star: first paying tourism client live within 30 days.

---

## Workstream B — Product (critical path)

| ID | Item | Status |
|---|---|---|
| B3-inc1 | Control-channel routing (`getControlChannel`, `control_channel` setting) | ✅ Done |
| B9 | Operator web console (Settings/KB, ROI, Contacts, Scheduled msgs, nav) | ✅ Done |
| B9-ux | Dashboard UX upgrade — health panel, two-tab Settings, industry KB templates, responsive design, waState tracking | ✅ Done |
| B2 | Tourism KB template (`demo/settings_tour.csv` + `defaults/settings_tour.csv`) | ✅ Done |
| B1 | Tourism intent tuning — `classifyIntent()` uses `business_context`; tourism examples added | ✅ Done |
| B4 | Qualify + capture + handoff flow (date, party size, trip type → warm lead → booking link) | ✅ Done |
| B3-inc2 | Accept `!commands` from Cay Control group (operator drives agent from personal number) | ✅ Done |
| B5 | Reliability: daily heartbeat + external uptime monitor (spec in `FUTURE_PLANS.md`) | ✅ Done — port 3001 health server, daily WhatsApp heartbeat, !status command, pm2 config; **founder action: enable UFW on droplet** (`ufw allow ssh`, `ufw allow 3001/tcp`, `ufw enable`) |
| B6 | Multi-client provisioning: generalize CI/CD from single hardcoded droplet; runbook | ⏸ Deferred — one client per droplet; branching model (`preview` → personal, `main` → clients) agreed; build when client #2 signs |
| B7 | Tourism onboarding runbook — step-by-step guide for spinning up a new client (QR scan → `!setup` wizard → tourism KB template → go-live checklist) | ⏸ Deferred — build when client #2 signs; intake form + checklist exist at `brand/sales/` |
| B8 | Pre-flight test pass: tourism KB ≥75% confidence gate added to `tests/index.test.js` | ✅ Done — run with `RUN_PREFLIGHT=true OPENROUTER_API_KEY=sk-or-xxx npm test`; skipped automatically in CI |

---

## Workstream A — Brand (Claude-produced, founder-approved)

| ID | Item | Status |
|---|---|---|
| A1 | Domains — `lucayanlabs.com` + `cayai.com` registered and pointed | ⬜ Pending (founder action — registrar purchase) |
| A2 | Logo system — Lucayan Labs wordmark + Cay AI product mark, SVG, `#0F6E56` primary | ✅ Done — `brand/logos/` (3 SVG files) |
| A3 | `lucayanlabs.com` — one-page company site, deploy-ready static HTML | ✅ Done — `brand/sites/lucayanlabs/index.html` |
| A4 | `cayai.com` — product landing page (Cay Receptionist, ROI framing, lead form) | ✅ Done — `brand/sites/cayai/index.html` |
| A5 | Pitch deck — tourism operator sales deck, content + layout | ✅ Done — `brand/deck/pitch-deck.html` (8 slides, print-ready) |
| A6 | Cay Receptionist one-pager — client handout PDF | ✅ Done — `brand/sales/one-pager.html` (print to PDF via browser) |
| A7 | Sales kit — email signature, proposal template, contract/SOW template | ✅ Done — `brand/sales/` (3 files) |

---

## Workstream C — GTM (founder-led, Claude-supported)

| ID | Item | Status |
|---|---|---|
| C1 | Target list — 12 Nassau prospects across tourism, hospitality, and service sectors | ✅ Done — `brand/sales/target-list-tourism-c1.csv` (template + qualifying criteria) |
| C2 | Outreach motion — WhatsApp DM scripts (5 business types), 3-touch email sequence, 20-min call script with 6 objection handlers | ✅ Done — `brand/sales/outreach-dm-script-c2.md`, `outreach-email-sequence-c2.md`, `call-script-c2.md` |
| C3 | Live demo instance — always-on "Cay Receptionist Demo" number; deployment guide written; **founder action: buy SIM + deploy** | ✅ Done (scripts) — `brand/sales/demo-setup-guide-c3.md` · ⬜ Founder action: provision SIM + run deployment |
| C4 | Proposal + close — per-prospect HTML proposal (duplicate from existing template); proposal follow-up cadence and close trigger documented | ✅ Done (process) — `brand/sales/proposal-template.html` (existing); populate per prospect per call |
| C5 | Onboarding + go-live — 10-topic KB intake form, go-live checklist (pre-session → QR scan → dashboard walkthrough → Day 14) | ✅ Done — `brand/sales/onboarding-intake-form-c5.md`, `onboarding-checklist-c5.md` |
| C6 | Success readout — 14-day ROI metric template, case study seed, referral ask | ✅ Done — `brand/sales/success-readout-template-c6.md`; populate after first client Day 14 |

---

## Deferred / Out of Scope (for this engagement)

- Windows `start.bat` launcher
- Multi-number / multi-role per instance
- Web/voice channels beyond WhatsApp
- Live calendar/availability or payment processing
- CRM sync, Zapier/webhook integration
- In-browser customer-message inbox (stays in WhatsApp — SOW boundary)
- Cay Sales Assistant, Booking Coordinator, Concierge, Dispatcher (future upsells)
- Conversation history context passed to AI
- Image/file sending commands
- `!quote`, `!draft`, `!remind` commands
- Multi-language (Bahamian Creole, Spanish)
