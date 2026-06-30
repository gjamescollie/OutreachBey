#!/bin/bash

# OutreachBey WhatsApp Agent — Mac Launcher
# Double-click this file to start the agent

cd "$(dirname "$0")"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  OutreachBey WhatsApp Agent"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Check Node.js
if ! command -v node &> /dev/null; then
  echo "❌ Node.js not found. Please install from https://nodejs.org"
  read -p "Press Enter to exit..."
  exit 1
fi

# Check Google Chrome
if [ ! -f "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" ]; then
  echo "❌ Google Chrome not found. Please install from https://google.com/chrome"
  read -p "Press Enter to exit..."
  exit 1
fi

# Check .env
if [ ! -f ".env" ]; then
  echo "⚠️  No .env file found. AI features need an API key."
  echo "    Create a .env file with your OPENROUTER_API_KEY."
fi

# Check settings
if [ ! -f "data/settings.csv" ]; then
  echo "❌ data/settings.csv not found. Please check your setup."
  read -p "Press Enter to exit..."
  exit 1
fi

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
  echo "📦 Installing dependencies (first run only)..."
  npm install --ignore-scripts
  echo ""
fi

# Create logs dir if missing (required by pm2)
mkdir -p logs

# Remove quarantine flags if present
xattr -r -d com.apple.quarantine "$HOME/.cache/puppeteer" 2>/dev/null

echo "🚀 Starting agent..."
echo "💬 Open contacts.html in your browser to manage contacts"
echo ""

# Use pm2 if installed (auto-restart on crash), otherwise fall back to node
if command -v pm2 &> /dev/null; then
  echo "⚙️  Starting with pm2 (auto-restart enabled)..."
  pm2 start ecosystem.config.js --no-daemon
else
  echo "⚠️  pm2 not found — running directly with node"
  echo "   Install pm2 for auto-restart: npm install -g pm2"
  PUPPETEER_EXECUTABLE_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" node index.js
fi

read -p "Agent stopped. Press Enter to exit..."
