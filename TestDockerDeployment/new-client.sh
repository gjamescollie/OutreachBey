#!/usr/bin/env bash
# Usage: ./new-client.sh <slug>
# Run from inside the TestDockerDeployment/ folder.
# Creates the directory structure and env file for a new OutreachBey client.

set -e

SLUG="$1"

if [ -z "$SLUG" ]; then
  echo "Usage: $0 <slug>  (e.g. normans-cay)"
  exit 1
fi

CLIENT_DIR="$(dirname "$0")/clients/$SLUG"

if [ -d "$CLIENT_DIR" ]; then
  echo "Client '$SLUG' already exists at $CLIENT_DIR"
  exit 1
fi

mkdir -p "$CLIENT_DIR"/{data,logs,.wwebjs_auth}
echo '[]' > "$CLIENT_DIR/followups.json"
echo 'timestamp,to_number,to_name,message,status,tokens' > "$CLIENT_DIR/data/log.csv"
cp "$(dirname "$0")/client.env.template" "$CLIENT_DIR/$SLUG.env"

echo "✅ Created client: $SLUG"
echo ""
echo "Next steps:"
echo "  1. Fill in API key and owner number:  nano clients/$SLUG/$SLUG.env"
echo "  2. Add contacts:                      cp your-contacts.csv clients/$SLUG/data/contacts.csv"
echo "  3. Add settings:                      cp your-settings.csv clients/$SLUG/data/settings.csv"
echo "  4. Add a service block to docker-compose.yml (copy an existing block, replace slug)"
echo "  5. Build and start:                   docker compose up -d $SLUG"
echo "  6. Scan QR:                           docker logs -f outreachbey-$SLUG"
