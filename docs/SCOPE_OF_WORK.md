# Cay AI — Scope of Work

**Prepared for:** Granville Collie, Founder & CEO, Lucayan Labs
**Prepared by:** Product (Claude Code), acting as senior PM
**Date:** June 2026
**Version:** 1.1 — Reconciled against repo audit (see §0 revision note)
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

> ⚠️ **Governance conflict to resolve:** `CLAUDE.md` still states "Do not add a web server or
> dashboard (not in scope)," but a dashboard now ships in `index.js`. Founder should either
> update `CLAUDE.md` to bless the dashboard or decide its future. Flagged, not changed here.

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

| ID | Deliverable | Detail |
|---|---|---|
| A1 | Domains live | `lucayanlabs.com` + `cayai.com` registered and pointed |
| A2 | Logo system | Lucayan Labs wordmark + Cay AI product mark, SVG, teal `#0F6E56` primary. Generated by Claude; founder picks final |
| A3 | lucayanlabs.com | One-page company site (master narrative, mission, contact) — deploy-ready static HTML |
| A4 | cayai.com | Product landing page (Cay Receptionist, ROI framing, lead form) — deploy-ready static HTML |
| A5 | Pitch deck | Tourism-operator sales deck, content + layout (problem → cost of problem → Cay Receptionist → ROI → pricing) |
| A6 | Cay Receptionist one-pager | Client handout PDF |
| A7 | Sales kit | Email signature, proposal template, contract/SOW template under Lucayan Labs |

**Voice guardrail on every asset:** AI employees, never "bots/chatbots." Open with the cost
of the problem, never with price. (Brand Voice §9, Locked Decisions §12.)

### Workstream B — Cay Receptionist Product (Claude-built)

| ID | Deliverable | Detail |
|---|---|---|
| B1 | Tourism intent tuning | Re-tune `classifyIntent()` prompt for boat-tour/charter inquiry phrasing; verify confidence gates (0.45 / 0.75) hold. **Seed from the existing `demo/settings_tour.csv` tour vertical** rather than starting cold |
| B2 | Tourism KB template | A reusable `settings.csv` KB pre-filled with the tourism question set, in natural customer language (fixes the known low-confidence KB issue). **Start from `demo/settings_tour.csv`; the current `defaults/settings.csv` is generic/self-referential and not reusable as-is** |
| B3 | Shared-number control model | Route escalations + `!commands` to a dedicated **Cay Control** channel instead of the customer inbox. Define how the agent distinguishes operator messages from customer messages on one number. **Increment 1 (notification routing) — DONE:** `control_channel` setting + `getControlChannel()` route all operator notifications off the shared line. **Increment 2 (planned):** accept `!commands` from the Cay Control group |
| B4 | Qualify + capture + handoff flow | On a real inquiry: answer, qualify (date, party size, trip type), capture contact to `contacts.csv`/log, hand warm lead to operator. Share operator booking link when configured. **No availability logic** (stays in Receptionist scope) |
| B5 | Reliability layer | **Auto-restart already done** via `docker-compose` `restart: unless-stopped`. Remaining: daily heartbeat (specced in `FUTURE_PLANS.md`) + an external uptime monitor |
| B6 | Hosting hardening | **CI/CD already exists** (`deploy.yml` auto-deploys to one droplet on push to `main`, Tailscale-served). Remaining: generalise from the single hardcoded path (`/root/cay-cay-ai-client1`) to repeatable **multi-client provisioning**; document the per-client runbook |
| B7 | Onboarding template | Annotated tourism `settings.csv` + step list so a new tourism client is configured in under an hour. **Builds on the existing `defaults/settings.csv`, `!setup` wizard, and `!addcontact`** |
| B8 | Pre-flight test pass | Extend the **existing `tests/index.test.js` / `npm test` harness**: all KB entries auto-answer ≥75% confidence; setup wizard preserves locked fields; opt-out fast-path verified |

**Build constraints (inherited, non-negotiable):** single `index.js` — do not split into
modules; no database; no message to a customer that bypasses the autonomy/escalation rules;
complaints always route to a human; bare "stop" never triggers opt-out. *(Note: a
password-gated analytics dashboard already ships in `index.js` and is in scope — see the §0
governance conflict against `CLAUDE.md`. The "no dashboard" line from v1.0 is retired.)*

### Workstream C — Go-to-Market & Close (founder-led, Claude-supported)

| ID | Deliverable | Detail |
|---|---|---|
| C1 | Target list | 10–15 Nassau boat-tour / fishing-charter / excursion / water-sports operators |
| C2 | Outreach motion | Short DM/email sequence + call script anchored on the cost-of-problem story |
| C3 | Live demo instance | **Demo verticals already built** (`TOUR`/`FOOD`/`REALTY`/`DRIVE`/`BEAUTY` in `demo/`). Remaining: stand up a dedicated always-on "Cay Receptionist Demo" number prospects can message live in a meeting |
| C4 | Proposal + close | Proposal template populated per prospect; $2,500 + $499/mo, no discount |
| C5 | Onboarding + go-live | KB build from operator's real FAQs, QR link to their number, staff training, go-live |
| C6 | Success readout | After 2 weeks live: inquiries answered, leads captured, bookings influenced, hours saved → first case study |

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
- Decision on the `CLAUDE.md` ↔ dashboard governance conflict (§0)

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

*Founder-confirmed and locked; v1.1 reconciled against the live repo. Workstream B build is
underway: B3 increment 1 (control-channel routing) is shipped. Next: B2 (tourism KB,
seeded from `demo/settings_tour.csv`).*
