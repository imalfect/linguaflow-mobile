# Linguaflow API — self-hosted variant.
# Runs the same Lambda handlers through the plain HTTP wrapper (src/local-server.ts).
# Build from the REPO ROOT (workspace install needs all package.json files):
#   docker build -f apps/api/Dockerfile -t linguaflow-api .

FROM oven/bun:1-alpine AS deps

WORKDIR /app

# Workspace manifests only — keeps the install layer cacheable.
COPY package.json bun.lock ./
COPY apps/api/package.json apps/api/
COPY apps/mobile/package.json apps/mobile/
COPY packages/shared/package.json packages/shared/

RUN bun install --frozen-lockfile

FROM oven/bun:1-alpine

WORKDIR /app

# Bun installs per-workspace node_modules (isolated linker) — copy all of them.
COPY --from=deps /app/node_modules node_modules
COPY --from=deps /app/apps/api/node_modules apps/api/node_modules
COPY --from=deps /app/packages/shared/node_modules packages/shared/node_modules
COPY package.json bun.lock ./
COPY packages/shared/package.json packages/shared/package.json
COPY packages/shared/src packages/shared/src
COPY packages/shared/tsconfig.json packages/shared/
COPY apps/api/package.json apps/api/package.json
COPY apps/api/src apps/api/src
COPY apps/api/tsconfig.json apps/api/
COPY apps/api/sst-env.d.ts apps/api/

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

WORKDIR /app/apps/api

# busybox wget ships with alpine — used by the compose healthcheck too
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/health > /dev/null || exit 1

CMD ["bun", "run", "src/local-server.ts"]
