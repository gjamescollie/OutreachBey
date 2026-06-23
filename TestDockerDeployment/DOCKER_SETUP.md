# OutreachBey — Docker Deployment Guide

This guide covers deploying OutreachBey to a Linux server (Ubuntu 22.04 recommended) 
using Docker, with one container per client. Each client is fully isolated — separate 
WhatsApp session, data, logs, and API key.

---

## Prerequisites

- A Linux VPS (DigitalOcean, Hetzner, Vultr, etc.) — 1 GB RAM minimum per 2 clients
- Docker + Docker Compose installed on the server
- A residential proxy (optional but strongly recommended — see Step 5)

---

## Required Code Changes to index.js

These two changes must be made to `index.js` **before building the Docker image**. 
They are not in the app yet — this folder is preparation for when you're ready.

### Required Change #1 — Chrome Executable Path

Find the Puppeteer client config block near the bottom of `index.js` (around line 1310):

```javascript
// BEFORE (Mac path — breaks in Docker)
puppeteer: {
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
```

Change it to:

```javascript
// AFTER — branches on IS_DOCKER env var set by the Dockerfile
puppeteer: {
  executablePath: process.env.IS_DOCKER
    ? (process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/google-chrome-stable')
    : '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
```

This lets the same `index.js` work on both your Mac (for development) and in Docker 
(for production) without any further changes.

### Required Change #2 — Proxy Support (optional)

If you want residential proxy support, find the same Puppeteer args block and add:

```javascript
args: [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',   // critical in Docker — /dev/shm is tiny
  '--disable-gpu',
  // Add this line if PROXY_URL is set in the client's .env:
  ...(process.env.PROXY_URL ? [`--proxy-server=${process.env.PROXY_URL}`] : []),
],
```

`--no-sandbox` and `--disable-setuid-sandbox` are required when Chrome runs as a 
non-root user inside a container. `--disable-dev-shm-usage` prevents crashes on 
servers with small shared memory.

---

## Server Setup

### 1. Install Docker

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
newgrp docker
```

### 2. Upload the project

Copy the entire `outreachbey-agent` folder to your server:

```bash
# From your Mac:
scp -r "/path/to/outreachbey-agent" user@your-server-ip:~/outreachbey
```

Or use `git clone` if you have it in a private repo.

### 3. Set up the deployment folder structure

Inside the project root on the server:

```
outreachbey/
├── index.js
├── package.json
├── TestDockerDeployment/
│   ├── production_dockerfile.dockerfile
│   ├── multi_client_compose_template.yaml   ← use as docker-compose.yml
│   ├── client.env.template
│   └── clients/
│       ├── normans-cay/
│       │   ├── normans-cay.env              ← filled-in copy of client.env.template
│       │   ├── data/
│       │   ├── logs/
│       │   ├── .wwebjs_auth/
│       │   └── followups.json
│       └── butler-boats/
│           └── ...
```

Create client directories with one command per client (replace `<slug>`):

```bash
cd ~/outreachbey/TestDockerDeployment
mkdir -p clients/<slug>/{data,logs,.wwebjs_auth}
echo '[]' > clients/<slug>/followups.json
cp client.env.template clients/<slug>/<slug>.env
```

Seed each client's `data/` folder with their contacts and settings:

```bash
cp /path/to/client-contacts.csv clients/<slug>/data/contacts.csv
cp /path/to/client-settings.csv clients/<slug>/data/settings.csv
echo 'timestamp,to_number,to_name,message,status,tokens' > clients/<slug>/data/log.csv
```

### 4. Fill in each client's .env file

```bash
nano clients/<slug>/<slug>.env
```

Fill in `OPENROUTER_API_KEY` and optionally `PROXY_URL`. Save and close.

### 5. Residential Proxy (recommended)

WhatsApp aggressively bans data-center IPs. A residential proxy makes your 
server's traffic look like it's coming from a home internet connection.

Recommended providers: Webshare, Bright Data, Oxylabs, Smartproxy.

Format for `PROXY_URL`:
```
http://username:password@proxy-provider.com:port
```

Without a proxy, the containers will likely work initially but risk being 
banned by WhatsApp within days to weeks.

### 6. Build and start

Copy the compose template to use as your compose file:

```bash
cd ~/outreachbey/TestDockerDeployment
cp multi_client_compose_template.yaml docker-compose.yml
```

Build the image (only needed once, or after code changes):

```bash
docker compose build
```

Start all clients:

```bash
docker compose up -d
```

### 7. Scan QR codes

Each new client needs to scan a QR code once to link their WhatsApp. 
Open the logs and watch for the QR code to appear:

```bash
docker logs -f outreachbey-normans-cay
```

The QR code will print as ASCII art in the terminal. Have the client scan it 
from their WhatsApp → Linked Devices → Link a Device.

After scanning, the session is saved in `.wwebjs_auth/` and will persist 
across container restarts automatically.

---

## Day-to-Day Operations

### View logs for a client
```bash
docker logs -f outreachbey-<slug>
```

### Restart a single client
```bash
docker compose restart <slug>
```

### Stop everything
```bash
docker compose down
```

### Add a new client

1. Create their directory and env file (Step 3 above)
2. Add their service block to `docker-compose.yml` (copy the template comment at the bottom)
3. Rebuild and start:
   ```bash
   docker compose build
   docker compose up -d <new-slug>
   ```

### Deploy a code update

When you update `index.js`:

```bash
# Pull latest code, then rebuild:
docker compose build
docker compose up -d   # rolling restart — sessions stay logged in
```

Sessions are stored in volumes, so the WhatsApp login survives rebuilds.

### Re-scan QR (if a session expires)

```bash
# Delete the old session for that client:
rm -rf clients/<slug>/.wwebjs_auth/*
docker compose restart <slug>
docker logs -f outreachbey-<slug>   # watch for QR
```

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `Error: Failed to launch the browser process` | Chrome path wrong | Apply Required Change #1 to index.js |
| Container crashes immediately | Missing `--no-sandbox` flag | Apply Required Change #2 |
| QR code appears but scan fails | Data-center IP blocked | Add a residential proxy |
| Session disconnects frequently | WhatsApp flagging the IP | Add or rotate residential proxy |
| `ENOENT followups.json` | File not created | Run `echo '[]' > clients/<slug>/followups.json` |
| Messages send but AI replies are wrong | Wrong settings.csv | Check `clients/<slug>/data/settings.csv` |

---

## Security Notes

- Never commit any `clients/<slug>/*.env` files to git — add `clients/` to `.gitignore`
- The `.wwebjs_auth/` folders contain WhatsApp session tokens — treat like passwords
- Each client's data is fully isolated — containers cannot access each other's volumes
- The Dockerfile runs Chrome as a non-root user (`outreachbey`) for container security
