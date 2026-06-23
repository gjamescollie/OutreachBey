# Use official Node LTS lightweight image
FROM node:18-slim

# Install system dependencies, Google Chrome Stable, and emoji/system fonts
# Installing fonts-noto-color-emoji prevents Puppeteer from rendering blank squares [ ]
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    ca-certificates \
    procps \
    fonts-liberation \
    fonts-noto-color-emoji \
    --no-install-recommends \
    && wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
    && sh -c 'echo "deb [arch=amd64] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list' \
    && apt-get update \
    && apt-get install -y google-chrome-stable \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Set working directory inside container
WORKDIR /usr/src/app

# Copy dependency files first to utilize Docker's cache layer
COPY package*.json ./

# Install Node dependencies
# --ignore-scripts is critical: stops Puppeteer from downloading its own 300MB unsigned Chromium binary
RUN npm install --ignore-scripts

# Copy the rest of the application files
COPY . .

# Ensure standard directories exist with write access
RUN mkdir -p logs data

# Set defaults
ENV NODE_ENV=production
ENV IS_DOCKER=true
# Tells Puppeteer where to find the system Chrome installed above.
# index.js must branch on IS_DOCKER to use this path — see DOCKER_SETUP.md.
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable

# Run as non-root for security — create a dedicated user
RUN groupadd -r outreachbey && useradd -r -g outreachbey -G audio,video outreachbey \
    && chown -R outreachbey:outreachbey /usr/src/app
USER outreachbey

# Launch directly via Node
CMD [ "node", "index.js" ]