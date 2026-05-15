# BabyLoop

BabyLoop is a long-term full-stack AI marketplace project for baby and family products.

This repository currently contains a small verified product foundation:

- pnpm workspaces
- Turborepo
- TypeScript
- `apps/web`: minimal Next.js app with browse, detail, sell, and favorites pages
- `apps/api`: Fastify API with health, marketplace read endpoints, manual listing creation, mock AI listing suggestions, and favorites
- `packages/shared`: shared API response type
- `packages/config`: shared app constants
- `packages/database`: Drizzle/PostgreSQL schema, migration, local seed data, and `ai_model_runs` audit table
- `packages/ai-core`: deterministic mock listing suggestion provider

Auth, admin, worker, mobile app, real AI providers, pricing, RAG, moderation, recommendations, notifications, and payments are intentionally delayed.

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

## Local Full-Stack Dev

Use this flow to run the read-only marketplace path locally.

1. Start or confirm PostgreSQL is running:

```bash
pg_isready -h 127.0.0.1 -p 5432
```

2. Create the local database if needed:

```bash
createdb -h 127.0.0.1 -p 5432 -U postgres babyloop_dev
```

3. Run migration and seed:

```bash
export DATABASE_URL="postgresql://postgres@127.0.0.1:5432/babyloop_dev"
pnpm --filter @babyloop/database db:migrate
pnpm --filter @babyloop/database db:seed
```

4. Start the API:

```bash
export DATABASE_URL="postgresql://postgres@127.0.0.1:5432/babyloop_dev"
PORT=4000 pnpm --filter @babyloop/api dev
```

If port `4000` is already in use, choose another port:

```bash
PORT=4100 pnpm --filter @babyloop/api dev
```

5. Start the web app:

```bash
BABYLOOP_API_BASE_URL=http://127.0.0.1:4000 pnpm --filter @babyloop/web dev
```

If the API uses port `4100`, match the web env var:

```bash
BABYLOOP_API_BASE_URL=http://127.0.0.1:4100 pnpm --filter @babyloop/web dev
```

6. Verify the read-only API:

```bash
curl http://127.0.0.1:4000/api/v1/categories
curl http://127.0.0.1:4000/api/v1/listings
curl http://127.0.0.1:4000/api/v1/listings/30000000-0000-4000-8000-000000000001
```

7. Verify the web pages:

```text
http://localhost:3000/browse
http://localhost:3000/listings/30000000-0000-4000-8000-000000000001
```

Expected seed data:

- 4 product categories
- 2 profiles
- 3 listings
- listing image metadata
- 1 favorite
- basic events

Current local feature checks:

```bash
curl http://127.0.0.1:4000/health
curl http://127.0.0.1:4000/api/v1/categories
curl http://127.0.0.1:4000/api/v1/listings
curl -X POST http://127.0.0.1:4000/api/v1/ai/listing-suggestions \
  -H 'content-type: application/json' \
  -d '{"title":"Chicco stroller","categoryName":"Strollers","condition":"good"}'
```

The mock AI endpoint writes to `ai_model_runs` when `DATABASE_URL` is configured. If database logging is unavailable, the suggestion response should still work.

Optional API CORS override:

```bash
CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000 pnpm --filter @babyloop/api dev
```
