# C5 — Go-Live Checklist

Work through this in order during the go-live / QR scan session. Do not call the client until all pre-session items are checked off.

---

## Pre-Session (Complete Before Calling the Client)

- [ ] `data/settings.csv` populated from intake form — all fields complete
- [ ] `business_name`, `owner_number`, `tone`, `signature`, `language_style` set
- [ ] `response_window` set to client's business hours
- [ ] `calendar_link` populated (or left blank if client has no booking link)
- [ ] `avoid_words` populated if client specified any
- [ ] `custom_instructions` populated if client has edge cases
- [ ] At least 15 KB FAQ pairs written in `data/settings.csv` (`faq_1_q`/`faq_1_a` through `faq_15_q`/`faq_15_a`)
- [ ] FAQ questions written in natural customer language (as customers would phrase them, not as the owner would)
- [ ] `control_channel` set to owner's personal WhatsApp number for escalations
- [ ] Agent instance deployed to DigitalOcean droplet (or running locally)
- [ ] `DASHBOARD_PASSWORD` set in `.env` — agent will refuse to start without it
- [ ] Agent process started — QR code visible in terminal or at `:3000`
- [ ] `npm test` passes (run before go-live: `cd /path/to/client-instance && npm test`)

---

## Go-Live Session (30 Minutes with Client)

### QR Scan
- [ ] Client has their phone in hand and WhatsApp open
- [ ] Walk client through: WhatsApp → Settings → Linked Devices → Link a Device
- [ ] Client scans QR code displayed by the agent
- [ ] Agent logs "Client is ready!" or equivalent connection confirmation in terminal
- [ ] Wait 15–30 seconds for full sync

### Test Messages (Send From Your Personal WhatsApp)
- [ ] Send a basic inquiry: "Hi, how much does [main service] cost?"
  - Confirm: response arrives within 15 seconds
  - Confirm: response is accurate and in the right voice
  - Confirm: response includes booking link (if configured)
- [ ] Send a question that should trigger KB: "[A common FAQ from the intake form]"
  - Confirm: response matches the KB answer
- [ ] Send a message that should escalate: "[A trigger from the escalation rules]"
  - Confirm: owner receives an escalation notification on their WhatsApp

### Dashboard Walkthrough (5 Minutes)
- [ ] Open dashboard at `http://[droplet-IP]:3000` (Tailscale URL or localhost tunnel)
- [ ] Show client the Logs page — confirm the test messages are showing
- [ ] Show client the Contacts page — confirm test contact was captured
- [ ] Show client the ROI page — explain what will populate over time
- [ ] Show client the Settings page — explain they can update KB entries here without restarting
- [ ] Confirm client has saved the `DASHBOARD_PASSWORD`

### Staff Briefing (If Client Has Staff)
- [ ] Explain what the agent handles automatically vs. what escalates to the owner
- [ ] Show how to read an escalation notification on WhatsApp
- [ ] If client wants to use `!commands`: walk through `!send`, `!help`
- [ ] Confirm no staff member will accidentally unlink the WhatsApp linked device

---

## Sign-Off

- [ ] Client sends a message to confirm everything "looks good" on WhatsApp
- [ ] Confirm billing: first month's $499 invoice sent or scheduled
- [ ] Note the go-live date for the C6 success readout (schedule Day 14 check-in call)
- [ ] Add client to the Day 14 calendar reminder

---

## Post Go-Live (First 48 Hours)

- [ ] Check agent logs at `:3000` the following morning — confirm real customer messages are being handled
- [ ] WhatsApp the client: "Everything running smoothly? Any questions from your end?"
- [ ] Spot-check 2–3 recent auto-replies for tone and accuracy
- [ ] If anything looks off — tune the KB entry in `data/settings.csv` and reload (no restart needed)

---

## Day 14 — Schedule C6 Success Readout

Mark this date: go-live date + 14 days. Book a 20-minute check-in call with the client.
See `brand/sales/success-readout-template-c6.md` for what to cover.
