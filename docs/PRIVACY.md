# Cay AI — Privacy & Data Usage Policy

**Version:** 1.0  
**Effective:** June 2026  
**Operator:** Lucayan Labs (Granville James Collie) — gjamescollie@gmail.com  

---

## What Cay AI Is

Cay AI is a private, locally-operated WhatsApp AI outreach agent deployed on behalf of individual small businesses in Nassau, Bahamas. It is **not a cloud service** — each deployment runs on a single Mac, is linked to one WhatsApp number, and stores all data in local files on that machine.

---

## Data Collected

### From Your Contacts (Inbound Messages)
When a person sends a WhatsApp message to a business using Cay AI, the following is recorded:

| Data | Where Stored | Purpose |
|------|-------------|---------|
| Phone number | `data/log.csv`, `data/contacts.csv` | Identify the sender, route replies |
| Message content | `data/log.csv` | Classification, response generation, audit trail |
| Message timestamp | `data/log.csv` | Activity timeline, analytics |
| Inferred intent | `data/log.csv` | Route to correct response flow (e.g. booking, complaint) |
| AI confidence score | `data/log.csv` | Quality control |

### From the Business Owner
Every message the owner sends through the linked WhatsApp number is logged, including commands (e.g. `!send`) and manual messages to contacts. This is for operational accountability and business intelligence.

### In Contacts List
`data/contacts.csv` stores: phone number, name, business, tags, notes, last contacted date, email address, and industry. This data is entered manually by the business operator.

---

## What Cay AI Does NOT Collect

- No passwords, PINs, or financial data
- No location data
- No media files (images, voice notes, documents) — only text message bodies
- No data from group chats (group messages are explicitly ignored)
- No browser cookies, tracking pixels, or device identifiers
- No data is sent to third parties except the AI API (see below)

---

## Third-Party Services

### OpenRouter API / Anthropic Claude
Message content (inbound customer messages and business context) is sent to the OpenRouter API to generate AI responses and classify message intent. This is the only external service that receives message content.

- OpenRouter Privacy Policy: https://openrouter.ai/privacy
- Anthropic Privacy Policy: https://www.anthropic.com/privacy
- Data sent: message text, business context (tone, FAQ entries, business name)
- Data NOT sent: contact phone numbers, contact names, email addresses

**You should not store sensitive personal data in the Knowledge Base (FAQ) fields**, as this content is sent to the AI provider on every classification request.

### WhatsApp (via whatsapp-web.js)
Cay AI connects to WhatsApp using the linked-device protocol (QR code scan). It operates as a WhatsApp client, subject to WhatsApp's Terms of Service and Privacy Policy. The business owner is responsible for ensuring their use of WhatsApp Business messaging complies with WhatsApp's policies.

---

## Data Storage & Retention

All data is stored locally on the Mac running the agent:

| File | Contains | Default Retention |
|------|---------|------------------|
| `data/log.csv` | All message events | Auto-rotated at 10 MB; backups kept indefinitely unless manually deleted |
| `data/contacts.csv` | Contact list | Kept until manually edited or deleted |
| `data/settings.csv` | Business configuration | Kept until manually edited |
| `followups.json` | Scheduled messages | Cleared on send or manual cancel |
| `.wwebjs_auth/` | WhatsApp session token | Kept until manually deleted or re-scanned |

Data is **not backed up to the cloud** by Cay AI. The business operator is responsible for their own backups.

---

## Opt-Out Handling

Cay AI implements a mandatory opt-out system:

- Contacts who send any of the following phrases are **immediately and permanently removed from outreach**: "stop messages", "stop messaging", "stop texting", "stop contacting", "unsubscribe", "remove me from", "opt out"
- The contact is tagged `inactive` in `contacts.csv` — the agent will not message them again
- The opt-out event is logged with timestamp for compliance records
- Soft opt-out signals ("not interested", "no thanks") are flagged to the owner for human review before any action is taken

**A bare "stop" does not trigger opt-out** — this is intentional to avoid accidental funnel drop-off from ambiguous messages.

---

## Data Subject Rights

Contacts have the right to request:

1. **Access** — to see what data is stored about them
2. **Correction** — to update inaccurate information
3. **Deletion** — to have their number, name, and message history removed from all local files
4. **Opt-out** — to stop receiving messages (handled automatically via opt-out keywords above)

To exercise these rights, contacts should message the business directly. The business operator is responsible for fulfilling these requests by editing `contacts.csv` and `log.csv` manually.

---

## Business Operator Responsibilities

By deploying Cay AI, the business operator agrees to:

1. **Obtain consent** before adding contacts to the outreach list — recipients should expect to receive WhatsApp messages from the business
2. **Honor opt-out requests** immediately (handled automatically by the agent)
3. **Keep contact data accurate** and up to date
4. **Not use the agent for spam** — mass unsolicited outreach is a violation of WhatsApp's Terms of Service and may result in account suspension
5. **Comply with applicable laws** — including the Bahamas Data Protection Act 2003 (as amended) and any sector-specific regulations
6. **Rotate API keys** if the `.env` file is ever shared or exposed
7. **Secure the machine** running the agent — all contact and message data lives on that device

---

## Security Measures

- API keys are stored in a `.env` file that must never be committed to version control or shared
- The `.wwebjs_auth/` session directory must be kept private — it grants WhatsApp access
- Log files may contain message content; treat `data/` as sensitive
- The `contacts.html` and `dashboard.html` tools are local-only and not exposed to the internet
- No remote access to the agent is provided by Lucayan Labs

---

## Changes to This Policy

Lucayan Labs may update this document as the product evolves. Changes will be noted with a new version date at the top of this file.

---

## Contact

**Lucayan Labs**  
Granville James Collie  
Nassau, Bahamas  
gjamescollie@gmail.com
