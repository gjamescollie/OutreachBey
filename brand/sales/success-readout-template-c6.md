# C6 — 14-Day Success Readout Template

Complete this after the Day 14 check-in call. This document serves two purposes:
1. Proof of value for the client (share with them as a summary)
2. Seed for the first case study and future sales conversations

---

## Client Details

- **Client name:** ___
- **Business type:** ___
- **Go-live date:** ___
- **Readout date:** ___ (Day 14 after go-live)
- **Prepared by:** Granville Collie, Lucayan Labs

---

## The Problem Before Cay Receptionist

*(In the client's words from the onboarding intake call)*

> "[Direct quote from client describing the missed-inquiry problem]"

Estimated pre-Cay weekly loss: ___ missed inquiries × $___ average booking value = $___ per week unrecovered.

---

## 14-Day Performance Metrics

Pull from `data/log.csv` and `contacts.csv` via the dashboard at `:3000` (`dashboard.html` / `roi.html`).

| Metric | Value | Notes |
|---|---|---|
| Total inbound messages handled automatically | ___ | From log.csv — all auto-handled rows |
| Unique new contacts captured | ___ | contacts.csv row count on Day 14 minus baseline on go-live day |
| Escalations to owner | ___ | Flagged messages that required human follow-up |
| Escalation rate | ___% | Escalations ÷ total inbound × 100 |
| Average response time | < 15 seconds | Agent responds in real-time — state as fact |
| Bookings influenced | ___ | From client (asked on Day 14 call) |
| Estimated revenue recovered | $___ | Bookings influenced × average booking value |
| Hours saved (estimated) | ___ hours | Total auto-handled × 3 min ÷ 60 |
| Monthly cost of Cay Receptionist | $499 | For ROI comparison |
| ROI multiple | ___x | Revenue recovered ÷ $499 |

---

## Day 14 Check-In Call Notes

**Call date:** ___
**Duration:** ___ minutes

1. "Have you noticed any messages the agent handled that surprised you — in a good way?"

   > ___

2. "Have you had to step in for anything it couldn't handle?"

   > ___

3. "Roughly how many bookings came through WhatsApp in the last two weeks?"

   > ___

4. "Is there anything you'd want it to do differently?"

   > ___

**KB tuning to do based on call:** ___

---

## Client Quote

*(Get a direct quote during or after the Day 14 call — ask: "How would you describe the experience so far in a sentence or two?")*

> "[Direct quote from client]"
>
> — [Owner Name], [Business Name]

---

## Standout Example

*(One specific story that makes the ROI concrete — look for this in the logs or ask the client)*

Example: "On [date], a group of 8 messaged at 10:47 PM asking about a private tour for the next morning. Cay Receptionist answered within 12 seconds, quoted the group rate, and sent the booking link. The client woke up to a confirmed reservation — a booking he would have missed entirely before."

**Your example:**

> ___

---

## What Comes Next

- **Month 2 renewal:** Next invoice of $499 due on [date]. Send a WhatsApp reminder 5 days before.
- **KB refinements:** Any updates from the Day 14 call should be applied to `data/settings.csv` within 48 hours.
- **Upsell signal:** If the client mentions wanting the AI to do *more* (book appointments, handle complaints, follow up with leads), note it here for future Cay role expansion: ___
- **Referral ask:** If the client is happy, ask on the Day 14 call: "Do you know any other business owners in Nassau who might benefit from this?" Most clients who are happy will give 1–2 names.

---

## Case Study Status

- [ ] Client gave permission to use metrics + quote in sales materials: Yes / No / Pending
- [ ] Case study published to `docs/case-study-[clientname]-c6.md`: ___
- [ ] Numbers added to pitch deck and one-pager: ___
- [ ] Used in next outreach wave (Touch 1 DM updated with real results): ___
