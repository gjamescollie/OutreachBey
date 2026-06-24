# Cay AI — Docker Deployment Guide

Two deployment paths exist: **Mac (local)** for development and testing, **DigitalOcean (Docker)** for every live client. This doc covers the Docker path.

---

## Quick Deploy — New Client

Run this one command on a fresh DigitalOcean droplet:

```bash
bash <(curl -s https://raw.githubusercontent.com/gjamescollie/OutreachBey/main/deploy.sh) \
  <client_name> <api_key> <whatsapp_number> [proxy_url]
```

**Arguments:**

| Argument | Required | Example |
|---|---|---|
| `client_name` | Yes | `acme-bakery` |
| `api_key` | Yes | `sk-or-v1-xxxx` (OpenRouter key) |
| `whatsapp_number` | Yes | `12425550100` (international, no + or spaces) |
| `proxy_url` | No | `http://user:pass@123.45.67.89:8080` |

**Example with proxy:**
```bash
bash <(curl -s https://raw.githubusercontent.com/gjamescollie/OutreachBey/main/deploy.sh) \
  acme-bakery sk-or-v1-xxxx 12425550100 http://user:pass@123.45.67.89:8080
```

**Example without proxy:**
```bash
bash <(curl -s https://raw.githubusercontent.com/gjamescollie/OutreachBey/main/deploy.sh) \
  acme-bakery sk-or-v1-xxxx 12425550100
```

### What the script does
1. Installs Docker if missing
2. Clones the repo to `~/cay-<client_name>/`
3. Writes `.env` from template (CLIENT_ID, API key, proxy)
4. Scaffolds `data/` with empty CSV headers and `followups.json`
5. Builds the Docker image
6. Starts the container in the background
7. Tails logs — QR code prints in the terminal

### Scan the QR
When the QR appears, the client scans it with WhatsApp → **Settings → Linked Devices → Link a Device → Scan QR**.

Press `Ctrl+C` once scanned. The container keeps running.

---

## Droplet Setup

**Recommended:** DigitalOcean Basic → Ubuntu 22.04 LTS → $6/mo (1 vCPU, 1GB RAM)

Add your SSH key during creation. SSH in:
```bash
ssh root@<droplet-ip>
```

Then run the deploy command above.

---

## Environment Variables

All variables live in `.env` in the deploy directory (`~/cay-<client_name>/`). Edit and restart the container to apply changes.

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `CLIENT_ID` | Yes | — | Client name shown in `/health` endpoint |
| `AI_PROVIDER` | No | `openrouter` | `openrouter` \| `anthropic` \| `openai` \| `google` |
| `AI_MODEL` | No | `anthropic/claude-haiku-4-5` | Model string passed to the provider |
| `OPENROUTER_API_KEY` | If using OpenRouter | — | OpenRouter API key |
| `ANTHROPIC_API_KEY` | If using Anthropic | — | Anthropic API key |
| `OPENAI_API_KEY` | If using OpenAI | — | OpenAI API key |
| `GOOGLE_API_KEY` | If using Google | — | Google Gemini API key |
| `PROXY_URL` | No | — | `http://user:pass@ip:port` — static residential proxy |
| `DATA_DIR` | No | `./data` | Override data directory path |
| `FOLLOWUPS_FILE` | No | `./followups.json` | Override followups file path |
| `IS_DOCKER` | Auto | — | Set by docker-compose — switches Chrome to `/usr/bin/chromium` |

### Proxy notes
- Use **static residential** proxies only — rotating IPs break WhatsApp sessions
- Recommended providers: IPRoyal (~$3/mo), Oxylabs, Bright Data, Smartproxy
- One dedicated IP per client number — never share an IP across clients
- `PROXY_URL` is passed to Chromium via `--proxy-server` at launch

---

## Container Layout

| Host path | Container path | Purpose |
|---|---|---|
| `./data/` | `/app/data/` | Contacts, settings, log CSV |
| `./.wwebjs_auth/` | `/app/.wwebjs_auth/` | WhatsApp session (delete to re-scan) |
| `./followups.json` | `/app/followups.json` | Scheduled follow-ups |
| `./.env` | loaded via `env_file` | API keys and config |

All data lives on the host — the container can be rebuilt without losing anything.

---

## Health Endpoint

Every running container exposes a health endpoint on port 3000:

```bash
curl http://<droplet-ip>:3000/health
```

Response:
```json
{ "status": "ok", "client_id": "acme-bakery", "uptime": 3600 }
```

**UptimeRobot setup (recommended):**
1. Go to uptimerobot.com → Add New Monitor
2. Type: HTTP(s)
3. URL: `http://<droplet-ip>:3000/health`
4. Interval: 5 minutes
5. Alert to your email

---

## Day-to-Day Operations

```bash
# View live logs
docker compose logs -f

# Restart container
docker compose restart

# Stop container
docker compose down

# Start stopped container
docker compose up -d

# Check container status
docker ps
```

---

## Shipping a Code Update

```bash
cd ~/cay-<client_name>
git pull
docker compose up --build -d
```

WhatsApp session and all data survive the rebuild.

---

## Re-scanning QR (Session Expired)

```bash
docker compose down
rm -rf .wwebjs_auth/
docker compose up -d
docker compose logs -f   # scan the new QR
```

---

## Troubleshooting

| Problem | Fix |
|---|---|
| QR code never appears | Run `docker compose logs` — look for Chromium errors. Check `shm_size: '256mb'` is in `docker-compose.yml` |
| Container exits immediately | Run `docker compose logs` — usually a missing `.env` or malformed `followups.json` (must contain `[]`) |
| AI replies fail | Check `.env` has a valid API key. Run `docker compose logs` and look for API error messages |
| Session expired / agent stops responding | Re-scan QR (see above) |
| Proxy not working | Confirm `PROXY_URL` format is `http://user:pass@ip:port`. Test: `curl --proxy $PROXY_URL https://ifconfig.me` from the droplet |
| Wrong IP shown by WhatsApp | Proxy not applied — check `PROXY_URL` in `.env` and restart container |
