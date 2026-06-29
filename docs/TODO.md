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
| B2 | Tourism KB template (`demo/settings_tour.csv` + `defaults/settings_tour.csv`) | ✅ Done |
| B1 | Tourism intent tuning — `classifyIntent()` uses `business_context`; tourism examples added | ✅ Done |
| B4 | Qualify + capture + handoff flow (date, party size, trip type → warm lead → booking link) | ⬜ Pending |
| B3-inc2 | Accept `!commands` from Cay Control group (operator drives agent from personal number) | ⬜ Pending |
| B5 | Reliability: daily heartbeat + external uptime monitor (spec in `FUTURE_PLANS.md`) | ⬜ Pending |
| B6 | Multi-client provisioning: generalize CI/CD from single hardcoded droplet; runbook | ⬜ Pending |
| B7 | Tourism onboarding template: annotated `settings.csv` + step list, sub-1-hour setup | ⬜ Pending |
| B8 | Pre-flight test pass: tourism KB ≥75% confidence gate added to `tests/index.test.js` | ⬜ Pending |

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
| C1 | Target list — 10–15 Nassau boat-tour / fishing-charter / excursion operators | ⬜ Pending |
| C2 | Outreach motion — DM/email sequence + call script on cost-of-problem story | ⬜ Pending |
| C3 | Live demo instance — always-on "Cay Receptionist Demo" number for meetings | ⬜ Pending |
| C4 | Proposal + close — per-prospect proposal at $2,500 + $499/mo | ⬜ Pending |
| C5 | Onboarding + go-live — KB build, QR link, staff training, go-live | ⬜ Pending |
| C6 | Success readout — 2-week case study with at least one ROI data point | ⬜ Pending |

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
