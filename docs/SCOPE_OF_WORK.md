# Cay AI — Scope of Work

**Prepared for:** Granville Collie, Founder & CEO, Lucayan Labs
**Prepared by:** Product (Claude Code), acting as senior PM
**Date:** June 2026
**Version:** 1.3 — Workstream C GTM kit complete; qualifying criteria expanded (see §4 C)
**Governing document:** *Lucayan Labs Brand Architecture v1.0* (all locked decisions inherited)

---

## 0. How to read this document

This is a working scope of work, not a brand restatement. Every naming, pricing,
positioning, and voice decision is inherited and locked from the Brand Architecture
document and is **not re-opened here**. What this document does is convert that brand
into a buildable, time-boxed plan to land and serve the **first paying tourism client**.

Decisions captured in the scoping interview are recorded in Section 2. All twelve are now
founder-confirmed; the SOW is locked for build.

**Revision note (v1.1 — repo audit).** A review of the live `gjamescollie/OutreachBey`
repo found the codebase materially ahead of v1.0's assumptions. The following already exist
and have been folded into §3, §4, §9:

- **Analytics dashboard** — a password-gated HTTP dashboard (`index.js` → `:3000`, serves
  `dashboard.html`, bound to localhost + Tailscale). v1.0 wrongly listed "no dashboard" as a
  constraint; it is now treated as a delivered asset that backs the §6 success metrics.
- **Auto-restart** — `docker-compose.yml` `restart: unless-stopped` covers crash recovery.
- **CI/CD deploy** — `.github/workflows/deploy.yml` auto-deploys to a DigitalOcean droplet on
  push to `main` (git pull → `docker compose build/up` → `tailscale serve`).
- **Tourism demo vertical** — `demo/settings_tour.csv` + the `TOUR` keyword demo path.
- **Test suite** — `tests/index.test.js` + `npm test`.
- **Onboarding scaffolding** — `defaults/settings.csv` template (generic, not tourism), the
  18-step `!setup` wizard, and `!addcontact`.

> ✅ **Governance conflict resolved (v1.1):** the founder blessed the dashboard. `CLAUDE.md`
> has been updated to permit the existing read-only, password-gated analytics dashboard while
> still prohibiting any other server surface or expansion into a management UI.

---

## 1. Objective

**Land and serve client #1 — a Nassau tourism operator running Cay Receptionist live on
their own WhatsApp, 24/7 — within 30 days, at full price ($2,500 setup + $499/month).**

Everything in this SOW is justified by that single outcome. Work that does not move a real
operator to "live and paying" is explicitly deferred (Section 9).

---

## 2. Decisions of record (from scoping interview)

| # | Decision | Choice | Status |
|---|---|---|---|
| 1 | SOW coverage | Brand + Agent, end-to-end | Confirmed |
| 2 | North-star milestone | First paying tourism client live | Confirmed |
| 3 | Who executes | Founder + Claude Code (no agency/contractor) | Confirmed |
| 4 | Timeline | 30 days to client #1 | Confirmed |
| 5 | Hosting | Cloud VM, founder hosts all clients (use existing DigitalOcean Docker path) | Confirmed |
| 6 | WhatsApp number | Client's **existing** number; AI works alongside the human team | Confirmed |
| 7 | Inbound autonomy | Full 24/7 auto-answer + lead capture; escalate on doubt | Confirmed |
| 8 | Brand production | Claude produces sites, copy, deck, one-pager, **and logo** | Confirmed |
| 9 | Booking boundary | Qualify + capture + hand to owner to close; share operator booking link when available | Confirmed |
| 10 | Client #1 status | Short close motion (pitch → demo → proposal); covers "no warm lead yet" | Confirmed |
| 11 | Operator control | Dedicated "Cay Control" WhatsApp group for escalations + `!commands`; real-time pings for bookings/complaints | Confirmed |
| 12 | Success metric | Lead with bookings recovered, leads captured, **and owner time saved**; support with response speed | Confirmed |

---

## 3. Current state vs. target (the real gap)

The codebase is more mature than the brand doc implies, which shrinks the build. The honest
gap is **product orientation**, not infrastructure.

| Capability | Today | Needed for client #1 |
|---|---|---|
| Inbound classifier | Exists (10+ intents, confidence-gated); a `TOUR` demo vertical already exists | Re-tune for real tourism inquiry language |
| Outbound owner commands | Mature (`!send`, `!broadcast`, `!addcontact`, previews) | Kept, but de-emphasized — receptionist is inbound-first |
| Knowledge base | 40-slot KB; generic `defaults/settings.csv` + a tourism-flavoured `demo/settings_tour.csv` to seed from | Tourism KB template (pricing, schedule, meeting point, what's included, weather/cancellation, group size) |
| Hosting / deploy | DigitalOcean Docker (`Dockerfile`, `docker-compose.yml`) **+ GitHub Actions auto-deploy to droplet on push to `main`** + Tailscale serving | Generalise from the single hardcoded droplet to **multi-client provisioning** |
| Operator notifications | **`control_channel` + `getControlChannel()` route all operator pings off the shared line (B3 increment 1 — done)** | B3 increment 2: accept `!commands` from the Cay Control group |
| Reliability | **Auto-restart via `docker-compose` `restart: unless-stopped`**; disconnect alert wired | Add daily heartbeat + external uptime monitor |
| Operator visibility | **Password-gated analytics dashboard on `:3000` (localhost + Tailscale)** | Keep; point operator to it for the §6 metrics |
| Onboarding | `defaults/settings.csv` template + 18-step `!setup` wizard + `!addcontact` | Tourism-specific onboarding template + a clean KB-build runbook |
| Testing | `tests/index.test.js` + `npm test` harness exists | Add a tourism KB-confidence pass on top |

**Key architectural note:** because the AI runs as a linked device on the operator's *main*
WhatsApp number, the current "message the owner" pattern would message the customer-facing
inbox. The escalation/control path must move to a dedicated channel (Workstream B3).

---

## 4. Workstreams

Three parallel tracks. Product (B) is the critical path; Brand (A) and GTM (C) run alongside.

### Workstream A — Brand & Public Presence (Claude-produced, founder-approved)

| ID | Deliverable | Detail | Status |
|---|---|---|---|
| A1 | Domains live | `lucayanlabs.com` + `cayai.com` registered and pointed | ⬜ Pending — founder action (registrar purchase + DNS) |
| A2 | Logo system | Official PNGs provided by founder: `brand/logos/Lucayan Labs logo.png` + `brand/logos/CayAI logo.png` | ✅ Done |
| A3 | lucayanlabs.com | One-page company site — `brand/sites/lucayanlabs/index.html` | ✅ Done |
| A4 | cayai.com | Product landing page (Cay Receptionist, ROI framing, lead form) — `brand/sites/cayai/index.html` | ✅ Done |
| A5 | Pitch deck | 8-slide tourism-operator sales deck, print-ready — `brand/deck/pitch-deck.html` | ✅ Done |
| A6 | Cay Receptionist one-pager | A4 print-to-PDF client handout — `brand/sales/one-pager.html` | ✅ Done |
| A7 | Sales kit | Email signature, proposal template, service agreement — `brand/sales/` | ✅ Done |

**Voice guardrail on every asset:** AI employees, never "bots/chatbots." Open with the cost
of the problem, never with price. (Brand Voice §9, Locked Decisions §12.)

> **Workstream A build complete (v1.2).** A2–A7 shipped on branch `claude/workstream-a-v3qprg`, merged to `main`. A1 remains a founder action — register domains and point DNS to the static files in `brand/sites/`.

### Workstream B — Cay Receptionist Product (Claude-built)

| ID | Deliverable | Detail |
|---|---|---|
| B1 | Tourism intent tuning | **DONE.** `classifyIntent()` now uses `business_context` dynamically (was hardcoded to Cay AI's product). `ON_THE_FENCE_BUYER` description genericised. Tourism examples added to `QUESTION`, `HOT_LEAD`, `BOOKING_CONFIRMATION`, and `ON_THE_FENCE_BUYER` key-phrase blocks |
| B2 | Tourism KB template | **DONE.** `demo/settings_tour.csv` — 20 natural-language KB Q&A entries (Blue Cay Charters specifics). `defaults/settings_tour.csv` — reusable onboarding template with same 20 questions + fill-in answers for any Nassau boat-tour/charter operator |
| B3 | Shared-number control model | **DONE (both increments).** Increment 1: `control_channel` setting + `getControlChannel()` route all operator notifications off the shared line. Increment 2: `message_create` listener guards commands to owner's personal chat or the Cay Control group — any other group is ignored |
| B4 | Qualify + capture + handoff flow | **DONE.** AI extracts date, party size, trip type, and notes; stores in `customerSessions[from].collected`; sends warm lead summary to control channel with booking link when configured. Trip type question added to HOT_LEAD qualifying flow |
| B5 | Reliability layer | **DONE.** Port 3001 health server, daily 8am WhatsApp heartbeat via `startHeartbeat()`, `!status` command, pm2 `ecosystem.config.js`. **Founder action:** enable UFW on droplet (`ufw allow ssh`, `ufw allow 3001/tcp`, `ufw enable`) |
| B6 | Hosting hardening | **Deferred — build when client #2 signs.** Architecture agreed: one client per droplet; branching model: `preview` branch → personal/beta instance, `main` branch → client droplets. `deploy.sh` already parameterised; `deploy.yml` has one hardcoded client path (update when needed). **Future:** create a client onboarding runbook covering `!setup` wizard, tourism KB template, and go-live checklist |
| B7 | Onboarding runbook | **Deferred — build when client #2 signs.** Intake form + go-live checklist already exist at `brand/sales/onboarding-intake-form-c5.md` and `onboarding-checklist-c5.md`. Remaining: step-by-step technical runbook for spinning up a new client instance (QR scan → `!setup` wizard → KB population → first heartbeat confirmation) |
| B8 | Pre-flight test pass | **DONE.** `tests/index.test.js` extended with 20-test "Tourism KB — pre-flight confidence gate" suite. Tests skip automatically when `RUN_PREFLIGHT` is unset (CI-safe). Run before client deploy: `RUN_PREFLIGHT=true OPENROUTER_API_KEY=sk-or-xxx npm test` |
| B9 | Operator web console | **Promoted to priority by founder.** Per-instance, password-gated browser console that *complements* WhatsApp (no in-browser customer-message send/approve). **Full 4-page dashboard delivered:** Logs (`logs.html`), Analytics (`analytics.html`), Contacts (`contacts.html`), Settings (`settings.html`). **Dashboard UX upgrade (DONE):** system health panel on Logs (WhatsApp state, uptime, memory, messages today), two-tab Settings (Business Settings / Operations), collapsible sections, industry KB Quick Start templates (7 verticals × 6 Q&A), AI model selector in Operations tab, responsive design at 900px and 600px across all 4 pages, `waState` variable tracking connection state in `index.js`, `waState` + `memMB` added to `/api/logs` response. **U3 — scheduled-message view/cancel (planned).** Added `DASHBOARD_ONLY=true` to run the console without WhatsApp. Boundaries: not multi-tenant, no new auth surface, never public |

**Build constraints (inherited, non-negotiable):** single `index.js` — do not split into
modules; no database; no message to a customer that bypasses the autonomy/escalation rules;
complaints always route to a human; bare "stop" never triggers opt-out. *(Note: the
password-gated **operator console** (Logs/Analytics/ROI/Contacts/Settings on `:3000`) is in
scope per B9 — `CLAUDE.md` blesses it with hard boundaries: not multi-tenant, no new auth
surface, no in-browser customer-message send/approve, never public.)*

### Workstream C — Go-to-Market & Close (founder-led, Claude-supported)

**Build complete (v1.3).** All GTM scripts, templates, and guides shipped to `brand/sales/`. Qualifying criteria expanded beyond tourism to cover all Nassau small businesses that take inbound WhatsApp inquiries (restaurants, salons/spas, real estate, car rental, driving services). C3 requires one founder action to go live (SIM + deployment). C4 and C6 are populated per prospect/client at execution time.

| ID | Deliverable | Detail | Status |
|---|---|---|---|
| C1 | Target list | 12-prospect CRM across Nassau tourism, hospitality, and service sectors. Qualifying criteria: active WhatsApp, takes bookings or reservations, owner-operated or small team, Facebook/Maps presence. | ✅ Done — `brand/sales/target-list-tourism-c1.csv` |
| C2 | Outreach motion | WhatsApp DM scripts for 5 business types + 48-hr follow-up; 3-touch email sequence with subject lines; 20-minute discovery call script with 6 objection handlers (price, trust, discount, competitor, capacity, timing). Anchor: cost-of-problem, never price. | ✅ Done — `outreach-dm-script-c2.md`, `outreach-email-sequence-c2.md`, `call-script-c2.md` |
| C3 | Live demo instance | `demo/settings_tour.csv` "Blue Cay Charters" persona deployed to a dedicated Bahamian number; prospects message it live mid-call. Deployment guide written. **Founder action: buy BTC/Aliv SIM + run deployment steps.** | ✅ Done (guide) — `brand/sales/demo-setup-guide-c3.md` · ⬜ Founder: provision + deploy |
| C4 | Proposal + close | Populate `brand/sales/proposal-template.html` per prospect within 2 hours of each positive call. No discount. 30-day cancel clause is the objection handler. Send as WhatsApp + email. | ✅ Done (process) — populate per prospect |
| C5 | Onboarding + go-live | 10-topic structured KB intake (60-min call), go-live checklist (pre-session → QR scan → dashboard walkthrough → 48-hr check), staff briefing. Uses existing `demo/settings_tour.csv` as KB template. | ✅ Done — `onboarding-intake-form-c5.md`, `onboarding-checklist-c5.md` |
| C6 | Success readout | 14-day ROI metrics (log.csv + contacts.csv via dashboard), client quote, standout booking example, case study seed, referral ask. Populate after first client Day 14. | ✅ Done (template) — `success-readout-template-c6.md` · ⬜ Populate after go-live |

---

## 5. 30-Day Timeline

| Week | Brand (A) | Product (B) | GTM (C) | Milestone |
|---|---|---|---|---|
| **1** | A1 domains, A2 logo drafts | B1 intent tuning, B2 tourism KB template | C1 target list, C2 outreach drafted | Demo instance + brand identity exist |
| **2** | A3/A4 sites, A6 one-pager | B3 control model, B4 qualify/handoff | C3 demo live, begin outreach | Demoable product on a real number |
| **3** | A5 deck, A7 sales kit | B5 reliability, B6 hosting, B7 onboarding | C4 proposals out, demos booked | Pitch-ready; product deployable |
| **4** | Polish, founder approval | B8 test pass, deploy client #1 | C5 onboard + go-live | **Client #1 live & paying** |

Weeks 1–2 build the demo so selling can start while product hardens. Selling and building
run in parallel — that's what makes 30 days viable.

---

## 6. Acceptance criteria (definition of done)

**Product**
- Cay Receptionist answers a tourism inquiry on the operator's number within seconds, 24/7
- ≥75% of template KB questions auto-answer at confidence ≥0.75 in the test pass
- Bookings, complaints, and low-confidence messages escalate to the operator via the Cay Control channel — never auto-resolved
- Survives a server reboot and an app crash unattended; daily heartbeat delivered
- Never calls itself a bot; never sends outside the autonomy/escalation rules

**Brand**
- Both domains resolve to live, on-voice pages; logo system delivered in SVG
- Pitch deck, one-pager, proposal, and contract exist under Lucayan Labs and pass the voice guardrail

**Business**
- One Nassau tourism operator signed at full price and live
- 2-week success readout produced with at least one ROI data point across bookings recovered, leads captured, or owner hours saved

---

## 7. Dependencies & inputs needed from founder

- Domain registrar access / payment for A1
- OpenRouter API key + DigitalOcean account for hosting *(droplet + GitHub Actions deploy secrets `DROPLET_HOST`/`DROPLET_USER`/`DROPLET_SSH_KEY` + Tailscale are already configured for client #1)*
- A strong `DASHBOARD_PASSWORD` set per client `.env` (the agent refuses to start the dashboard without one)
- For client #1: operator's real FAQs, pricing, schedule, meeting point, booking link, and a second/personal number for the Cay Control channel
- Final logo selection and brand-asset sign-off

## 8. Risks & mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| whatsapp-web.js linked-device is against WhatsApp ToS | Number could be limited | One number per client, human-like cadence, dedicated session; monitor; have re-link runbook |
| AI + human on one shared inbox collide | Double replies / confusion | Clear operator-vs-customer detection (B3); escalation handoff pauses auto-reply on that thread |
| Low KB confidence on real phrasing | Wrong/again-escalated answers | Tourism KB written in natural customer language (B2); test pass gate (B8) |
| 30 days is aggressive for build + sell | Slip | Demo-first sequencing; brand assets are Claude-produced to protect founder time |
| Single founder + single host = single point of failure | Outage | Uptime monitor + auto-restart (B5); documented runbook (B6) |
| First operator expects real-time booking | Scope creep into Booking Coordinator | Hold the line at qualify + handoff (locked); position booking as a future Cay role |

## 9. Explicitly out of scope (for this engagement)

- Cay Sales Assistant, Booking Coordinator, Concierge, Dispatcher (future upsells — locked)
- Live calendar/availability or payment processing
- Multi-number / multi-role per instance, web & voice channels
- Any non-tourism vertical
- Database, or splitting `index.js` (architecturally prohibited). *Note: the analytics dashboard already exists and is NOT out of scope — expanding it into a full management UI is, for now*
- Discounting for early clients (locked)

## 10. Commercials (inherited, for reference)

- Setup: $2,500 one-time per deployment
- Monthly: $499/month per AI employee
- Sales framing: open with the cost of the problem, not the price
- Scale target: 20 clients ≈ $10,000/month recurring + setup revenue

---

*Founder-confirmed and locked; v1.3 updated June 2026. Shipped: B3 increment 1, B9 (full
4-page operator web console + UX upgrade: health panel, two-tab Settings, industry KB
templates, responsive design, waState tracking), B1 (intent tuning), B2 (tourism KB template),
C1–C6 GTM sales kit (target list, DM/email/call scripts, demo deployment guide, onboarding
intake + go-live checklist, 14-day success readout template). Qualifying criteria expanded to
all Nassau small businesses taking inbound WhatsApp inquiries (not tourism-only).
Critical-path remaining: B4 (qualify + handoff), B3 increment 2, B5 (reliability), B6
(multi-client), B7, B8; C3 founder action (SIM + demo deployment). For live build status see
`docs/TODO.md`.*
