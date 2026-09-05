FROM node:24-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Install Chromium and dependencies for headless browser automation
RUN apk add --no-cache \
      chromium \
      nss \
      freetype \
      harfbuzz \
      ca-certificates \
      ttf-freefont

COPY package*.json ./
COPY server/package*.json ./server/
COPY server/dist ./server/dist
COPY client/dist ./client/dist

RUN cd server && npm install --omit=dev

EXPOSE 3001

CMD ["node", "server/dist/index.js"]
