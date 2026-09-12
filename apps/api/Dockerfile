# BalSanskar API.
#
# Multi-stage so the shipped image carries no compiler, no source and no dev
# dependencies. The result runs as a non-root user with a read-only-friendly
# layout, because this will sit on infrastructure the team does not control.

# ---------------------------------------------------------------------------
FROM node:22-bookworm-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /app

# ---------------------------------------------------------------------------
FROM base AS deps
# Only the manifests first, so a source-only change reuses the install layer.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --filter @balsanskar/api... --filter @balsanskar/shared

# ---------------------------------------------------------------------------
FROM deps AS build
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN pnpm --filter @balsanskar/shared build \
 && pnpm --filter @balsanskar/api exec prisma generate \
 && pnpm --filter @balsanskar/api build

# Strip development dependencies from the tree that gets copied forward.
RUN pnpm prune --prod

# ---------------------------------------------------------------------------
FROM base AS runtime
ENV NODE_ENV=production
# Node's own signal handling is enough (server.ts installs SIGTERM/SIGINT
# handlers), but tini reaps any grandchild a migration might leave behind.
RUN apt-get update \
 && apt-get install -y --no-install-recommends tini openssl ca-certificates curl \
 && rm -rf /var/lib/apt/lists/*

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages/shared/dist ./packages/shared/dist
COPY --from=build /app/packages/shared/package.json ./packages/shared/
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=build /app/apps/api/package.json ./apps/api/
COPY --from=build /app/apps/api/prisma ./apps/api/prisma

# The local storage driver writes here when no object store is configured.
RUN mkdir -p /app/apps/api/storage && chown -R node:node /app/apps/api/storage
USER node
WORKDIR /app/apps/api

EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -fsS http://127.0.0.1:${PORT:-4000}/v1/health || exit 1

ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "dist/server.js"]
