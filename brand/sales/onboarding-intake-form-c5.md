# C5 — Client Onboarding Intake Form

**Use on the 60-minute KB onboarding session call.** Work through all 10 topics. Capture answers verbatim — you'll rewrite in the client's voice during KB build, but raw answers are the source material.

Estimated time per topic: 4–6 minutes. Don't rush topics 5 and 8 — they're the most important for KB quality.

---

## Before the Call

- Have a blank copy of `data/settings.csv` (use `demo/settings_tour.csv` as the structural template)
- Have this form open for note-taking
- Have Calendly open to book the go-live session at the end of the call

---

## Topic 1 — Business Identity

> "Let's start with the basics — I want to make sure the AI represents you exactly right."

- Official business name (as customers know it): ___
- Owner's first name (for the AI's sign-off): ___
- WhatsApp number to connect the AI to: ___
- Business hours (days + times): ___
- Do you operate year-round or seasonally?: ___
- Primary service area / location / address customers should know: ___

---

## Topic 2 — Services & Pricing

> "Walk me through everything you offer — I'll capture every option so the AI can quote accurately."

For each service/tour/offering, capture:
- Name of service: ___
- Duration: ___
- Price (adult): ___ | Price (child, if applicable): ___ | Private/group rate: ___
- What's included: ___
- What's NOT included (important for managing expectations): ___
- Max group size: ___

Repeat for each service. Most businesses have 2–5.

---

## Topic 3 — Logistics & Meeting Points

> "If a customer asks 'where do I meet you?' — what's the exact answer?"

- Primary pickup/meeting point (exact location, landmark, or address): ___
- Instructions for cruise ship passengers (if applicable): ___
- Instructions for resort/hotel guests: ___
- Parking situation: ___
- Any logistics that frequently confuse first-timers: ___

---

## Topic 4 — Booking Process

> "How does a customer actually lock in a booking with you right now?"

- Booking method (WhatsApp only / website / phone / Calendly link): ___
- Deposit required?: ___ Amount or %: ___
- Cancellation policy: ___
- Rescheduling policy: ___
- Payment methods accepted (cash / card / online transfer / Zelle / etc.): ___
- Booking lead time required (e.g., "at least 24 hours notice"): ___
- Do you have a booking link to share in messages?: ___

---

## Topic 5 — Top Customer Questions

> "What are the 10 questions you get every single week — the ones you've answered a thousand times?"

Let the client speak. Capture their exact words. Aim for 10–15 questions minimum.

1. ___
2. ___
3. ___
4. ___
5. ___
6. ___
7. ___
8. ___
9. ___
10. ___
11. ___
12. ___
13. ___
14. ___
15. ___

These become the KB FAQ entries. The more verbatim you capture, the better the AI will match real customer language.

---

## Topic 6 — Voice & Tone

> "How would you describe the vibe of how you talk to customers? Formal, casual, warm, professional — what fits you best?"

- Overall tone (circle): Formal / Professional / Friendly-Pro / Casual / Bahamian Warm
- Any phrases or expressions you use a lot that feel like you: ___
- Anything that would sound wrong or out of character: ___
- Language: English only, or any Bahamian expressions welcome?: ___
- How do you sign off on messages (e.g., "Cheers, [Name]" / "Looking forward to it!"): ___

---

## Topic 7 — What the AI Should Never Do

> "Are there any promises or statements the AI should absolutely never make?"

Examples to prompt: never promise a specific boat, never quote a group rate without confirming headcount, never promise refunds, never guarantee weather, never book without a deposit.

- ___
- ___
- ___
- ___

---

## Topic 8 — Escalation Rules

> "What types of messages do you want the AI to flag to you immediately rather than handling on its own?"

Default escalations are already built in (complaints, low confidence, bookings over a threshold). Capture any custom rules:

- Flag to me when: ___
- Flag to me when: ___
- Flag to me when: ___

Owner's WhatsApp number for escalation notifications (can be same as business number or a personal number): ___

Is there a second person (co-owner, manager) who should also receive escalation alerts?: ___ Number: ___

---

## Topic 9 — Booking / Calendar Link

> "Do you have a link customers can use to book — Calendly, a website booking page, anything like that?"

- Booking link URL: ___
- Should the AI include this link in every inquiry response, or only when specifically asked?: ___
- If no link: Is this something you'd want to set up? (Calendly free tier takes 10 minutes): ___

---

## Topic 10 — Anything Else

> "Is there anything else a customer might ask that we haven't covered — or anything about your business that's unique or important for the AI to know?"

- Special policies, exceptions, or context: ___
- Current promotions or seasonal offers: ___
- Anything that makes your business different from competitors: ___

---

## End of Call — Next Steps

1. Confirm the go-live timeline: KB build takes 1 day after this call; linked device session takes 30 minutes
2. Book the go-live / QR scan session: [Calendly link]
3. Ask the client to have their phone available and WhatsApp open for the QR scan session
4. Confirm the dashboard password they want to use for `DASHBOARD_PASSWORD` in `.env`

> "I'll have everything built by [date]. We'll hop on a quick 30-minute call, you'll scan a QR code on your phone, and the agent is live on your number from that moment. I'll stay on while you send a test message to confirm it's working."
