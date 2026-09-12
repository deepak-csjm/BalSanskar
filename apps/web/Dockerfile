# BalSanskar web client.
#
# Builds the static bundle and serves it from nginx. Nothing dynamic runs here:
# the API is a separate service, which keeps the public surface of the static
# host to a directory of hashed files.

FROM node:22-bookworm-slim AS base
ENV PNPM_HOME=/pnpm
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /app

FROM base AS build
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY packages/shared/package.json packages/shared/
COPY apps/web/package.json apps/web/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --filter @balsanskar/web... --filter @balsanskar/shared

COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/web apps/web

# Baked into the bundle at build time, so a deployment targeting a different
# API needs a rebuild rather than a runtime surprise.
ARG VITE_API_BASE_URL=""
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

RUN pnpm --filter @balsanskar/shared build && pnpm --filter @balsanskar/web build

FROM nginx:1.27-alpine AS runtime
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/ >/dev/null || exit 1
