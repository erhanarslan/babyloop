# BabyLoop

BabyLoop is a long-term full-stack AI marketplace project for baby and family products.

This repository currently contains only the minimal technical foundation:

- pnpm workspaces
- Turborepo
- TypeScript
- `apps/web`: minimal Next.js app
- `apps/api`: minimal Fastify API
- `packages/shared`: shared API response type
- `packages/config`: shared app constants

Product features, auth, database, AI modules, admin, worker, and mobile app are intentionally not implemented yet.

## Install

```bash
pnpm install
```

## Development

Run all dev servers:

```bash
pnpm dev
```

Run a single app:

```bash
pnpm --filter @babyloop/web dev
pnpm --filter @babyloop/api dev
```

## Typecheck and Build

```bash
pnpm typecheck
pnpm build
```

## Verification

Web:

```bash
pnpm --filter @babyloop/web dev
```

Open `http://localhost:3000` and confirm the page shows `BabyLoop`.

API:

```bash
pnpm --filter @babyloop/api dev
```

Then verify the health endpoint:

```bash
curl http://localhost:4000/health
```

Expected API response:

```json
{
  "ok": true,
  "service": "babyloop-api"
}
```

Marketplace API routes require PostgreSQL:

```bash
export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/babyloop_dev"
pnpm --filter @babyloop/database db:migrate
pnpm --filter @babyloop/database db:seed
pnpm --filter @babyloop/api dev
```
