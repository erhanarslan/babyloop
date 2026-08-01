# syntax=docker/dockerfile:1.7

ARG NODE_VERSION=22.23.2
ARG COREPACK_VERSION=0.35.0
ARG PNPM_VERSION=10.33.0

FROM node:${NODE_VERSION}-bookworm-slim AS base
ARG COREPACK_VERSION
ARG PNPM_VERSION
ENV PNPM_HOME=/pnpm
ENV PATH=${PNPM_HOME}:${PATH}
RUN npm install --global corepack@${COREPACK_VERSION} \
    && corepack enable \
    && corepack install --global pnpm@${PNPM_VERSION} \
    && test "$(pnpm --version)" = "${PNPM_VERSION}"
WORKDIR /workspace

FROM base AS builder
COPY . .
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile

FROM builder AS api-build
RUN pnpm --filter @babyloop/api build \
    && pnpm --filter @babyloop/api deploy --prod --legacy /out/api \
    && rm -rf /out/api/dist \
    && cp -R apps/api/dist /out/api/dist \
    && mkdir -p /out/api/docs/rag /out/api/migrations /out/api/scripts/deploy \
    && cp -R docs/rag/. /out/api/docs/rag/ \
    && cp -R packages/database/drizzle/. /out/api/migrations/ \
    && cp scripts/deploy/worker-loop.mjs /out/api/scripts/deploy/worker-loop.mjs

FROM node:${NODE_VERSION}-bookworm-slim AS api
ENV NODE_ENV=production
ENV API_HOST=0.0.0.0
ENV PORT=4000
WORKDIR /app
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/*
COPY --from=api-build --chown=node:node /out/api ./
USER node
EXPOSE 4000
HEALTHCHECK --interval=20s --timeout=5s --start-period=20s --retries=5 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:4000/health/live').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"]
CMD ["node", "dist/server.js"]

FROM builder AS web-build
ARG NEXT_PUBLIC_API_BASE_URL
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_BACKOFFICE_BASE_URL
ARG NEXT_PUBLIC_LEGAL_OPERATOR_NAME
ARG NEXT_PUBLIC_LEGAL_CONTACT_EMAIL
ARG NEXT_PUBLIC_LEGAL_RELEASE_MODE
ARG NEXT_PUBLIC_LEGAL_COMMERCIAL_ACTIVITY_ENABLED
ARG NEXT_PUBLIC_LEGAL_PUBLIC_LOCATION
ARG NEXT_PUBLIC_LEGAL_CONTACT_ADDRESS
ENV NEXT_PUBLIC_API_BASE_URL=${NEXT_PUBLIC_API_BASE_URL}
ENV NEXT_PUBLIC_SITE_URL=${NEXT_PUBLIC_SITE_URL}
ENV NEXT_PUBLIC_BACKOFFICE_BASE_URL=${NEXT_PUBLIC_BACKOFFICE_BASE_URL}
ENV NEXT_PUBLIC_LEGAL_OPERATOR_NAME=${NEXT_PUBLIC_LEGAL_OPERATOR_NAME}
ENV NEXT_PUBLIC_LEGAL_CONTACT_EMAIL=${NEXT_PUBLIC_LEGAL_CONTACT_EMAIL}
ENV NEXT_PUBLIC_LEGAL_RELEASE_MODE=${NEXT_PUBLIC_LEGAL_RELEASE_MODE}
ENV NEXT_PUBLIC_LEGAL_COMMERCIAL_ACTIVITY_ENABLED=${NEXT_PUBLIC_LEGAL_COMMERCIAL_ACTIVITY_ENABLED}
ENV NEXT_PUBLIC_LEGAL_PUBLIC_LOCATION=${NEXT_PUBLIC_LEGAL_PUBLIC_LOCATION}
ENV NEXT_PUBLIC_LEGAL_CONTACT_ADDRESS=${NEXT_PUBLIC_LEGAL_CONTACT_ADDRESS}
RUN pnpm --filter @babyloop/web build

FROM node:${NODE_VERSION}-bookworm-slim AS web
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
WORKDIR /app
COPY --from=web-build --chown=node:node /workspace/apps/web/.next/standalone ./
COPY --from=web-build --chown=node:node /workspace/apps/web/.next/static ./apps/web/.next/static
COPY --from=web-build --chown=node:node /workspace/apps/web/public ./apps/web/public
USER node
EXPOSE 3000
HEALTHCHECK --interval=20s --timeout=5s --start-period=20s --retries=5 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/').then(r=>{if(r.status>=500)process.exit(1)}).catch(()=>process.exit(1))"]
CMD ["node", "apps/web/server.js"]

FROM builder AS backoffice-build
ARG NEXT_PUBLIC_API_BASE_URL
ENV NEXT_PUBLIC_API_BASE_URL=${NEXT_PUBLIC_API_BASE_URL}
RUN pnpm --filter @babyloop/backoffice build

FROM node:${NODE_VERSION}-bookworm-slim AS backoffice
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3001
WORKDIR /app
COPY --from=backoffice-build --chown=node:node /workspace/apps/backoffice/.next/standalone ./
COPY --from=backoffice-build --chown=node:node /workspace/apps/backoffice/.next/static ./apps/backoffice/.next/static
USER node
EXPOSE 3001
HEALTHCHECK --interval=20s --timeout=5s --start-period=20s --retries=5 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3001/').then(r=>{if(r.status>=500)process.exit(1)}).catch(()=>process.exit(1))"]
CMD ["node", "apps/backoffice/server.js"]
