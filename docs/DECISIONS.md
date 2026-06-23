# OutreachBey — Decisions Log

Key decisions made during development. Each entry explains what was chosen, what was rejected, and why.

---

## WhatsApp Connection: Linked Device vs Meta Cloud API

**Chosen:** whatsapp-web.js (linked device)
**Rejected:** Meta Cloud API

**Why:**
The Meta Cloud API requires phone number verification via SMS or voice call. The client's numbers were no longer accessible for SMS verification but could receive WhatsApp messages. The linked device approach requires only a QR code scan from an existing WhatsApp account, eliminating the verification problem entirely.

**Trade-off:** whatsapp-web.js is technically against WhatsApp ToS and could get a number flagged at high volume. Acceptable for the current scale and target market.

---

## Cloud Platform: Local Mac vs Replit vs Railway

**Chosen:** Local Mac (for now)
**Rejected:** Replit (attempted), Railway (future)

**Why:**
Replit's sandbox environment had persistent Puppeteer/Chrome library issues (`libglib`, `libxcb` missing). Rather than continue debugging sandbox restrictions, the decision was made to run locally on Mac using system Chrome. This works reliably and is simpler for the MVP phase. Cloud deployment is planned for production/enterprise.

---

## Browser: System Chrome vs Puppeteer Bundled Chrome

**Chosen:** System Chrome (`/Applications/Google Chrome.app/...`)
**Rejected:** Puppeteer's auto-downloaded Chrome

**Why:**
macOS security (Gatekeeper) blocks unsigned binaries. Puppeteer's downloaded Chrome was blocked even after quarantine flag removal because the Google Chrome for Testing framework file was missing. System Chrome is already trusted by macOS and works reliably.

**Implementation:** `executablePath` is hardcoded in the Client config. The `start.command` launcher sets `PUPPETEER_EXECUTABLE_PATH` as a fallback.

---

## Data Storage: CSV vs Database

**Chosen:** CSV files
**Rejected:** SQLite, Google Sheets API, MongoDB

**Why:**
CSV is zero-dependency, portable, and editable by non-technical clients in Excel or Numbers. Google Sheets API was specifically rejected to minimize external API dependencies. The local contact manager (`contacts.html`) provides a GUI without requiring any server. CSV is appropriate for the contact volume of a Bahamian small business.

**Trade-off:** No concurrent write safety. Not suitable for high-volume deployments.

---

## AI Provider: OpenRouter vs Anthropic Direct

**Chosen:** OpenRouter (default), with direct provider support as fallback
**Rejected:** Single-provider lock-in

**Why:**
OpenRouter gives clients model choice (Claude, GPT, Gemini) from a single API key and single billing relationship. As the operator, Granville can hold the key and mark up the cost, or clients can bring their own key. The `AI_PROVIDER` and `AI_MODEL` env vars make switching a one-line change with no code modifications.

---

## Inbound Classification: Keyword Matching vs AI Classifier

**Chosen:** Hybrid — hard keyword fast-path + AI classifier
**Rejected:** Pure keyword matching, pure AI

**Why:**
Pure keyword matching had ~60-70% accuracy and missed paraphrases. Pure AI would be slower and costlier for every message. The hybrid approach uses instant keyword matching only for hard unambiguous opt-outs (legally important, must be instant), and AI classification for everything else. This gives ~90-95% accuracy at ~$0.0003 per classification.

---

## Opt-Out Trigger: Single Word vs Multi-Word Phrase

**Chosen:** Multi-word phrases ("stop messages", "stop messaging", "unsubscribe")
**Rejected:** Single word "stop"

**Why:**
"Stop" appears naturally in conversation ("stop playing", "stop by", "don't stop"). Using a single word would cause accidental funnel drop-off. The multi-word requirement ensures intent is unambiguous. The AI classifier additionally catches softer opt-out phrasing with a confirmation step before acting.

---

## Command Interface: WhatsApp Self-Messages vs Separate App

**Chosen:** WhatsApp self-messages with `!commands`
**Rejected:** Separate web dashboard, Telegram bot

**Why:**
The owner is already on WhatsApp all day. Having the command interface in the same app requires zero context switching. The `message_create` event specifically catches messages the owner sends from their own device, keeping the interface natural and mobile-first.

---

## Preview Flow: Auto-Send vs Approval Required

**Chosen:** Preview → approve with "yes" / "no" before sending
**Rejected:** Auto-send on command

**Why:**
AI can produce unexpected outputs. For a business's reputation, it's critical that no message goes out without human review. The preview flow adds one extra step but prevents embarrassing or inaccurate messages from being sent. Broadcasting also shows a sample message for approval before sending to all contacts.

---

## Purpose Classification: No Context vs 5 Categories

**Chosen:** Ask purpose (Sales, Follow Up, Relationship, Information, Support) before generating
**Rejected:** Single tone for all messages

**Why:**
Without purpose context, the AI defaulted to promotional/sales-y language regardless of the actual intent. A "relationship" message to an existing client should feel completely different from a "sales" message to a new lead. The 5-category system gives the AI enough context to vary tone appropriately without adding complexity for the owner.

---

## Knowledge Base: 10 Entries vs 20 Entries

**Chosen:** 20 entries
**Reasoning:** More KB entries directly improve AI classifier accuracy for the QUESTION intent. Each entry is a potential auto-answer. For a product like OutreachBey with many common pre-sales questions, 20 entries covers the full buyer journey from awareness to objection handling.

---

## Contact Lookup: Number Only vs Name or Number

**Chosen:** Accept both name and number in all commands
**Rejected:** Number-only

**Why:**
In real outreach workflows you think in names, not numbers. Forcing number lookup creates friction. The `resolveRecipient()` function handles name-to-number resolution, multiple match disambiguation, and falls back gracefully with a clear error message.

---

## Settings Persistence: Hardcoded vs Dynamic CSV

**Chosen:** All business config in `settings.csv`, read fresh on every operation
**Rejected:** Config in `index.js` or loaded once at startup

**Why:**
Clients need to update their business info, FAQs, and tone without restarting the agent or editing code. Reading from CSV on every call means changes take effect immediately. The `!setup` wizard writes to this file, and the operator can also edit it directly.
