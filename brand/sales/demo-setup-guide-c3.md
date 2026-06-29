# C3 — Live Demo Instance Setup Guide

The demo instance is the single highest-leverage asset in the GTM sprint. It must be live before the first outreach message goes out. Every DM, email, and call script references the demo number.

**Goal:** A second Bahamian WhatsApp number running the "Blue Cay Charters" persona 24/7 so prospects can message it live during a sales call and experience the product from the customer's perspective.

---

## What You Need

- A spare Android handset (any cheap unlocked Android will do)
- A BTC or Aliv prepaid SIM (Bahamian number, +1-242-XXX-XXXX format)
- Access to the existing DigitalOcean droplet (or your Mac for a local instance)

---

## Step 1 — Get the Demo SIM Active

1. Buy a BTC or Aliv prepaid SIM from any BTC/Aliv store or authorized dealer in Nassau
2. Insert into the spare Android handset
3. Activate with a small top-up ($5 BDS is enough — WhatsApp uses data, not SMS)
4. Open WhatsApp on the device and register the new number
5. Note the full number in international format: `+1-242-XXX-XXXX`
6. Record the demo number in `brand/sales/outreach-dm-script-c2.md` where `[XXX-XXXX]` appears

---

## Step 2 — Deploy the Demo Instance

### Option A: DigitalOcean droplet (recommended — always-on, no Mac dependency)

The Dockerfile and docker-compose.yml in the repo are already written for this. Estimated time: 20 minutes.

```bash
# SSH into the existing droplet
ssh root@[DROPLET_HOST]

# Create a new directory for the demo instance
mkdir -p /root/cay-demo && cd /root/cay-demo

# Clone or copy the repo
git clone https://github.com/gjamescollie/OutreachBey.git .

# Copy the tour demo settings as the active settings
cp demo/settings_tour.csv data/settings.csv

# Create .env for the demo instance
cat > .env << EOF
OPENROUTER_API_KEY=[your key]
DASHBOARD_PASSWORD=[strong password]
EOF

# Start on a different port to avoid conflict with any existing client instance
# Edit docker-compose.yml to map port 3001:3000 before running
sed -i 's/3000:3000/3001:3000/' docker-compose.yml

# Build and start
docker compose up -d --build
```

The container auto-restarts on crash (`restart: unless-stopped` is already in docker-compose.yml).

### Option B: Local Mac (simpler, but requires Mac to stay on)

```bash
# Duplicate the project folder
cp -r /path/to/OutreachBey /path/to/cay-demo
cd /path/to/cay-demo

# Copy tour demo settings
cp demo/settings_tour.csv data/settings.csv

# Update .env — set PORT=3001 to avoid conflict
echo "PORT=3001" >> .env

# Start
node index.js
```

---

## Step 3 — Update Demo Settings

Open `data/settings.csv` on the demo instance and verify:

- `calendar_link` — update to your **real** Calendly link (`calendly.com/gjamescollie/30min` or current). A prospect who clicks to book during the demo becomes a real lead.
- `owner_number` — set to your own WhatsApp number so demo escalations come to you, not a client
- `business_name` — leave as "Blue Cay Charters" (authentic demo persona)
- `tone` — `friendly-pro` (already set in `demo/settings_tour.csv`)

---

## Step 4 — Link the Demo SIM

1. On the demo Android handset, open WhatsApp
2. On the running agent instance, a QR code will display in the terminal (or at `:3001` in the browser)
3. On the handset: Settings → Linked Devices → Link a Device → scan the QR code
4. Wait ~10 seconds for the connection to confirm

---

## Step 5 — Test Before First Outreach

From your personal WhatsApp, message the demo number:

- "Hi, how much is a tour?"
- "What time do you leave?"
- "Do you go to Swimming Pig Beach?"
- "I have a group of 8, what's the price?"

Verify responses are:
- Fast (under 15 seconds)
- In the right voice (friendly, Bahamian, authentic)
- Accurate to the Blue Cay Charters KB
- Ending with the Calendly booking link on lead-capture responses

If any response is wrong or missing, check `data/settings.csv` KB entries and adjust.

---

## Step 6 — Record the Demo Number

Add to `brand/sales/outreach-dm-script-c2.md`:
```
Demo WhatsApp: +1-242-[XXX-XXXX]
```

Add to `brand/sales/call-script-c2.md` in the live demo pivot section.

---

## Maintaining the Demo Instance

- The demo Android handset must stay powered on and connected to WiFi/data at all times
- WhatsApp linked devices expire after ~14 days of inactivity — if the handset goes offline, re-scan the QR
- The DigitalOcean instance auto-restarts on crash; check it is still running before scheduled sales calls
- To check status: `ssh root@[DROPLET_HOST] && docker ps` — look for the demo container running
- If the demo container is stopped: `cd /root/cay-demo && docker compose up -d`

---

## In-Meeting Demo Flow

When on a call with a prospect:

> "I want to show you something rather than explain it. Can you open WhatsApp right now? Message +1-242-[XXX-XXXX] — just say 'Hi, how much is a tour?' and watch what comes back."

Wait 10–15 seconds.

> "That's what your customers would experience — except it would be your number, your name, your prices, your policies."

The demo closes more deals than any slide or explanation.
