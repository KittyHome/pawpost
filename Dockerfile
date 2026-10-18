# syntax=docker/dockerfile:1
# One Dockerfile, two images:
#   docker build --target web    -t pawpost-web .
#   docker build --target worker -t pawpost-worker .

FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /app

# ── Dependencies (cached until a manifest or the lockfile changes) ──────────
FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/web/package.json apps/web/
COPY apps/worker/package.json apps/worker/
COPY packages/ai/package.json packages/ai/
COPY packages/core/package.json packages/core/
COPY packages/db/package.json packages/db/
COPY packages/engine/package.json packages/engine/
COPY packages/mail/package.json packages/mail/
COPY packages/tsconfig/package.json packages/tsconfig/
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile --ignore-scripts

# ── Build both apps ─────────────────────────────────────────────────────────
FROM deps AS build
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter @pawpost/web build && pnpm --filter @pawpost/worker build

# ── Web: Next.js standalone server ──────────────────────────────────────────
FROM node:22-alpine AS web
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
COPY --from=build --chown=node:node /app/apps/web/.next/standalone ./
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1
CMD ["node", "apps/web/server.js"]

# ── Worker: single bundled file + SQL migrations ────────────────────────────
FROM node:22-alpine AS worker
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build --chown=node:node /app/apps/worker/dist ./dist
USER node
CMD ["node", "dist/index.js"]
