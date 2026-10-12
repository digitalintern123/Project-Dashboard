# ==============================================================================
# ENCALM PROJECT DASHBOARD - PRODUCTION IMAGE
# Stage 1 builds the SPA and compiles the server; stage 2 runs plain Node with
# production dependencies only (no TypeScript tooling).
# ==============================================================================

FROM node:26-alpine AS builder
WORKDIR /app
# Toolchain for native modules (better-sqlite3)
RUN apk add --no-cache python3 make g++
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:26-alpine AS runner
WORKDIR /app
# sqlite: CLI for scripts/backup.sh; dumb-init: forwards signals for graceful shutdown
RUN apk add --no-cache sqlite dumb-init

ENV NODE_ENV=production
ENV PORT=5000
ENV API_PORT=5000

COPY package.json package-lock.json ./
RUN apk add --no-cache --virtual .build python3 make g++ \
    && npm ci --omit=dev --no-audit --no-fund \
    && apk del .build

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server/dist ./server/dist
COPY scripts/backup.sh scripts/restore.sh ./scripts/

RUN mkdir -p /app/server/data/uploads && chown -R node:node /app/server/data
USER node

EXPOSE 5000
VOLUME ["/app/server/data"]
ENTRYPOINT ["/usr/bin/dumb-init", "--"]
CMD ["node", "--enable-source-maps", "server/dist/index.js"]
