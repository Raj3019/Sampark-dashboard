# Dashboard (Next.js) for Dokploy. Build context = REPO ROOT,
# dockerfile path: apps/dashboard/Dockerfile
FROM node:22-bookworm-slim

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN corepack enable && corepack prepare pnpm@12.6.0 --activate

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/dashboard/package.json apps/dashboard/package.json
COPY packages/shared/package.json packages/shared/package.json

RUN pnpm install --frozen-lockfile

COPY packages/shared/ packages/shared/
COPY apps/dashboard/ apps/dashboard/

RUN pnpm --filter @sabha/dashboard build

EXPOSE 3000

ENV PORT=3000
WORKDIR /app/apps/dashboard

CMD ["npx", "next", "start"]
