# ── Stage 1: build ────────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build && ls dist/main.js

# ── Stage 2: runtime ──────────────────────────────────────────────
FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/migrations ./migrations
COPY --from=builder /app/src ./src
COPY tsconfig.json tsconfig.build.json nest-cli.json ./
COPY docker-entrypoint.sh .
RUN chmod +x docker-entrypoint.sh

EXPOSE 3000
CMD ["sh", "docker-entrypoint.sh"]
