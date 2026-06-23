# Docker Deployment Guide — Cay AI

## Prerequisites
- Docker Desktop installed (Mac/Windows/Linux)
- `.env` file present in the project folder
- `data/settings.csv` and `data/contacts.csv` populated

---

## First-Time Setup (New Client)

### 1. Prepare the folder
```bash
# Copy the project folder for the new client
cp -r outreachbey-agent/ clients/acme-biz/
cd clients/acme-biz/

# Clear any existing WhatsApp session
rm -rf .wwebjs_auth/

# Reset logs (keep header row)
echo "timestamp,to_number,to_name,message,status,tokens" > data/log.csv

# Reset follow-ups
echo "[]" > followups.json
```

### 2. Configure the client
Edit `.env` with the client's API key:
```
OPENROUTER_API_KEY=sk-or-...
```

### 3. Build and start
```bash
docker compose up --build -d
```

### 4. Scan the QR code
```bash
docker logs -f outreachbey
```
Watch the logs — a QR code will print in the terminal. Scan it with the client's WhatsApp. Once you see `✅ Authenticated` and `🚀 ... Agent is live!`, the agent is running.

Press `Ctrl+C` to stop following logs (the container keeps running).

---

## Day-to-Day Operations

### Start the agent
```bash
docker compose up -d
```

### Stop the agent
```bash
docker compose down
```

### View live logs
```bash
docker logs -f outreachbey
```

### Restart after code update
```bash
docker compose up --build -d
```

### Check if it's running
```bash
docker ps
```

---

## Re-scanning QR (session expired)

WhatsApp sessions are saved in `.wwebjs_auth/` and persist across restarts. If the session ever expires:

```bash
docker compose down
rm -rf .wwebjs_auth/
docker compose up -d
docker logs -f outreachbey   # scan the new QR
```

---

## File Locations Inside the Container

| Host path | Container path | Purpose |
|---|---|---|
| `.wwebjs_auth/` | `/app/.wwebjs_auth/` | WhatsApp session |
| `data/` | `/app/data/` | Contacts, settings, logs |
| `followups.json` | `/app/followups.json` | Scheduled messages |
| `.env` | loaded via `env_file` | API keys |

All data files are mounted as volumes — they live on the host, not inside the container. The container can be destroyed and rebuilt without losing any data.

---

## Deploying Updates

To ship a code update to a running client:

```bash
git pull   # get latest index.js
docker compose up --build -d
```

The WhatsApp session and all data survive the rebuild.

---

## Troubleshooting

**QR code never appears**
- Run `docker logs outreachbey` — look for Chromium errors
- Check that `shm_size: '256mb'` is in `docker-compose.yml`

**"Session expired" / agent stops responding**
- Re-scan QR (see above)

**Agent starts but AI replies fail**
- Check `.env` has a valid `OPENROUTER_API_KEY`
- Run `docker logs outreachbey` and look for API error messages

**Container exits immediately**
- Run `docker logs outreachbey` — usually a missing `.env` or malformed `followups.json`
- Make sure `followups.json` contains `[]` (not empty)
