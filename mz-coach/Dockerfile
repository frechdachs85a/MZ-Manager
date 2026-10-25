# MZ Coach als Container: Next.js-Server plus Chromium für den ManagerZone-Abruf.
# Basis: offizielles Playwright-Abbild in genau der Version aus package-lock (Browser passt dazu).
FROM mcr.microsoft.com/playwright:v1.63.0-noble AS bau
# Werkzeuge zum Übersetzen von better-sqlite3, falls kein fertiges Binärpaket passt
RUN apt-get update && apt-get install -y --no-install-recommends build-essential && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build && npm prune --omit=dev

FROM mcr.microsoft.com/playwright:v1.63.0-noble
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    DATABASE_PATH=/data/mz-coach.db
COPY --from=bau /app/package.json ./
COPY --from=bau /app/node_modules ./node_modules
COPY --from=bau /app/.next ./.next
COPY --from=bau /app/public ./public
# Datenbank liegt auf einem dauerhaften Laufwerk unter /data (beim Anbieter als Volume einhängen)
RUN mkdir -p /data
EXPOSE 3000
# Port vom Hoster (Railway setzt PORT), sonst 3000
CMD ["sh", "-c", "exec npx next start -p ${PORT:-3000}"]
