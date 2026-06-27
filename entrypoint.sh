#!/bin/sh
# Cay AI entrypoint — seeds data/ on first run, then starts the agent.
set -e

DATA_DIR="${DATA_DIR:-/app/data}"
SETTINGS="$DATA_DIR/settings.csv"
DEFAULTS="/app/defaults/settings.csv"

mkdir -p "$DATA_DIR"

# Seed settings if missing entirely
if [ ! -f "$SETTINGS" ]; then
  echo "⚙️  Seeding settings from defaults..."
  cp "$DEFAULTS" "$SETTINGS"

# Seed KB entries if settings exist but KB is empty (no faq_1_q line)
elif ! grep -q "^faq_1_q," "$SETTINGS"; then
  echo "⚙️  Appending KB entries to existing settings..."
  grep "^faq_" "$DEFAULTS" >> "$SETTINGS"
fi

# Seed contacts if missing
CONTACTS="$DATA_DIR/contacts.csv"
if [ ! -f "$CONTACTS" ]; then
  echo "number,name,business,tags,notes,last_contacted,email,industry" > "$CONTACTS"
fi

# Seed log if missing
LOG="$DATA_DIR/log.csv"
if [ ! -f "$LOG" ]; then
  echo "timestamp,to_number,to_name,message,status,tokens,confidence,direction,command" > "$LOG"
fi

# Seed followups if missing
FOLLOWUPS="${FOLLOWUPS_FILE:-/app/followups.json}"
if [ ! -f "$FOLLOWUPS" ]; then
  echo "[]" > "$FOLLOWUPS"
fi

# Clear stale Chromium profile locks left by an unclean shutdown.
# Without this, a crashed container leaves SingletonLock/Cookie/Socket
# files that make every subsequent Chromium launch fail with Code 21,
# crash-looping the container.
AUTH_DIR="${WWEBJS_AUTH_DIR:-/app/.wwebjs_auth}"
if [ -d "$AUTH_DIR" ]; then
  find "$AUTH_DIR" -name "SingletonLock" -delete 2>/dev/null || true
  find "$AUTH_DIR" -name "SingletonCookie" -delete 2>/dev/null || true
  find "$AUTH_DIR" -name "SingletonSocket" -delete 2>/dev/null || true
  echo "🧹 Cleared stale Chromium profile locks"
fi

exec node index.js
