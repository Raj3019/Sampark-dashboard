# Sync worker + agent frontend for Dokploy (single always-on container).
# Build context must be the REPO ROOT (monorepo), dockerfile path: apps/sync/Dockerfile
FROM node:22-bookworm-slim

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN corepack enable && corepack prepare pnpm@12.6.0 --activate

WORKDIR /app

# Install workspace deps from the lockfile first (cache-friendly)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/sync/package.json apps/sync/package.json
COPY apps/sync/frontend/package.json apps/sync/frontend/package.json
COPY packages/shared/package.json packages/shared/package.json

RUN pnpm install --frozen-lockfile

# Copy the rest of the repo (what's needed for the sync app)
COPY packages/shared/ packages/shared/
COPY apps/sync/src/ apps/sync/src/
COPY apps/sync/tsconfig.json apps/sync/tsconfig.json
COPY apps/sync/frontend/ apps/sync/frontend/

# Build the sync frontend
RUN pnpm --filter sabha-sync-frontend build

# Chromium system libraries for Playwright + browser itself
RUN npx --prefix apps/sync playwright install --with-deps chromium

EXPOSE 3000

ENV PORT=3000
WORKDIR /app/apps/sync/frontend

CMD ["npx", "next", "start"]
