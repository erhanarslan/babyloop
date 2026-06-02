# BabyLoop

BabyLoop is a long-term full-stack AI marketplace project for baby and family products.

This repository currently contains a verified local MVP foundation:

- pnpm workspaces
- Turborepo
- TypeScript
- `apps/web`: Next.js app with home, browse, listing detail, sell, favorites, my listings, auth, and messaging pages
- `apps/api`: Fastify API with health, auth, marketplace listings, favorites, mock AI listing suggestions, and messaging endpoints
- `packages/shared`: shared API response type
- `packages/config`: shared app constants
- `packages/database`: Drizzle/PostgreSQL schema, migration, local seed data, and `ai_model_runs` audit table
- `packages/ai-core`: deterministic mock listing suggestion provider

The first auth slice is implemented: email/password register, login, `GET /api/v1/auth/me`, access-token protected listing creation, favorites, my listings, and messaging flows.

Admin, worker, mobile app, real AI providers, pricing, RAG, moderation, recommendations, notifications, and payments are intentionally delayed.

## Current Implemented Features

Implemented:

| Area | Current state |
| --- | --- |
| Auth | Email/password register and login, `GET /api/v1/auth/me`, signed access tokens, basic auth rate limiting. |
| Listings | Public active listing list/detail, authenticated listing creation, authenticated `/api/v1/me/listings`, web browse/detail/sell/my-listings pages. |
| Listing images | Optional image URL metadata can be stored and rendered with graceful fallback. Real upload/storage is not implemented. |
| Favorites | Authenticated favorite/unfavorite/list API and web UI. Users cannot favorite their own listings or inactive listings. |
| Messaging | Authenticated conversation API, web conversations list, web thread page, and plain text send UI. Conversations are one channel per profile pair with listing contexts. |
| Mock AI | Deterministic mock listing suggestion provider, API endpoint, sell-page integration, and `ai_model_runs` logging when DB is available. |
| Tests | API integration tests with Vitest and `fastify.inject`. |

Partially implemented:

| Area | Current limitation |
| --- | --- |
| Auth/session | Access-token auth exists, but browser storage is still local-MVP level. No refresh/session table or HTTP-only cookie flow yet. |
| Listing discovery | Public list/detail exists, but search/filter/pagination are limited or missing. |
| Messaging | List/thread/send works, but no realtime delivery, unread counts, reporting, blocking, attachments, notifications, or moderation. |
| AI | Mock suggestion flow exists. No real LLM provider, price recommendation, RAG, moderation, or recommendation engine yet. |

Not implemented:

- Google OAuth
- password reset and email verification
- real image upload/storage
- listing edit/archive/delete lifecycle as user-facing API/UI
- admin panel
- mobile app
- payments
- realtime messaging
- moderation/trust and safety workflows
- production observability/deployment pipeline

Intentionally deferred:

- admin, worker, and mobile apps
- real AI providers, pricing, RAG, recommendations, and AI moderation
- notifications and background automation
- production-grade auth/session hardening

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

Single-app `dev`, `build`, and `typecheck` scripts build required internal workspace packages first, so these commands are safe after a fresh clone.

## Typecheck and Build

```bash
pnpm typecheck
pnpm build
```

The root commands use Turborepo and build package dependencies before apps.

## Validation Commands

Currently available validation commands:

```bash
pnpm typecheck
pnpm build
pnpm test
pnpm --filter @babyloop/api test
pnpm --filter @babyloop/api typecheck
pnpm --filter @babyloop/web typecheck
pnpm --filter @babyloop/database typecheck
pnpm --filter @babyloop/database db:check
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
export AUTH_SECRET="local-dev-auth-secret-change-me-please-32chars"
export AUTH_TOKEN_TTL_SECONDS=900
export AUTH_RATE_LIMIT_MAX=10
export AUTH_RATE_LIMIT_WINDOW_SECONDS=60
pnpm --filter @babyloop/api dev
pnpm --filter @babyloop/database db:migrate
pnpm --filter @babyloop/database db:seed
pnpm --filter @babyloop/api dev
```

## Local Full-Stack Dev

Use this flow to run the current marketplace path locally.

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
export AUTH_SECRET="local-dev-auth-secret-change-me-please-32chars"
export AUTH_TOKEN_TTL_SECONDS=900
pnpm --filter @babyloop/database db:migrate
pnpm --filter @babyloop/database db:seed
```

4. Start the API:

```bash
export DATABASE_URL="postgresql://postgres@127.0.0.1:5432/babyloop_dev"
export AUTH_SECRET="local-dev-auth-secret-change-me-please-32chars"
export AUTH_TOKEN_TTL_SECONDS=900
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

7. Verify the web pages and auth-owned flows:

```text
http://localhost:3000/browse
http://localhost:3000/listings/30000000-0000-4000-8000-000000000001
http://localhost:3000/register
http://localhost:3000/login
http://localhost:3000/sell
http://localhost:3000/favorites
http://localhost:3000/my-listings
http://localhost:3000/conversations
```

Expected seed data:

- 2 local QA users linked to seeded profiles
- 4 product categories
- 2 profiles
- 3 listings
- listing image metadata
- 1 favorite
- basic events

## Local QA Accounts

These accounts are seeded for local development only:

| Profile | Email | Password |
| --- | --- | --- |
| Ayse Demir | `ayse@example.com` | `Test123456` |
| Mehmet Kaya | `mehmet@example.com` | `Test123456` |

Passwords are stored as local seed hashes, not plaintext database values.

## Manual QA Flow

This flow resets the local `babyloop_dev` database. Use it only for disposable local data.

1. Reset local schemas:

```bash
psql "postgresql://postgres:postgres@127.0.0.1:5432/babyloop_dev" \
  -c "DROP SCHEMA IF EXISTS drizzle CASCADE; DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;"
```

2. Migrate and seed:

```bash
export DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5432/babyloop_dev"
pnpm --filter @babyloop/database db:migrate
pnpm --filter @babyloop/database db:seed
```

3. Start the API:

```bash
export DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5432/babyloop_dev"
export AUTH_SECRET="local-dev-auth-secret-change-me-please-32chars"
export AUTH_TOKEN_TTL_SECONDS=900
PORT=4000 pnpm --filter @babyloop/api dev
```

4. Start the web app:

```bash
BABYLOOP_API_BASE_URL=http://127.0.0.1:4000 pnpm --filter @babyloop/web dev
```

5. Browser QA:

- Open `http://localhost:3000/login`.
- Login as `ayse@example.com` / `Test123456`.
- Browse listings at `/browse`.
- Open Mehmet's car seat listing: `/listings/30000000-0000-4000-8000-000000000002`.
- Confirm listing detail shows seller, image/fallback, condition, listing type, favorite action, and message action.
- Favorite Mehmet's listing.
- Open `/favorites` and confirm the saved listing appears.
- Open `/sell`, create a manual listing, and confirm redirect to its detail page.
- Open `/my-listings` and confirm the created listing appears.
- From Mehmet's listing detail, start a conversation with Mehmet.
- Confirm redirect to `/conversations/:id`.
- Send a plain text message.
- Open `/conversations` and confirm the conversation appears.
- Reopen the conversation thread and confirm the message appears.
- Logout, then login as `mehmet@example.com` / `Test123456`.
- Open `/conversations`, open the conversation thread, and reply.

Current local feature checks:

```bash
curl http://127.0.0.1:4000/health
curl http://127.0.0.1:4000/api/v1/categories
curl http://127.0.0.1:4000/api/v1/listings
curl -i http://127.0.0.1:4000/api/v1/favorites
curl -X POST http://127.0.0.1:4000/api/v1/ai/listing-suggestions \
  -H 'content-type: application/json' \
  -d '{"title":"Chicco stroller","categoryName":"Strollers","condition":"good"}'
```

## Productization Blockers

- production-grade auth/session transport
- Google OAuth
- listing edit/archive/delete lifecycle
- image upload/storage and media validation
- search/filter/pagination
- messaging unread state, realtime delivery, report, and block flows
- admin/moderation tools
- trust and safety policy enforcement
- CI, deployment, and observability

## API Integration Tests

API integration tests use Vitest with `fastify.inject`, so they do not open a real HTTP port.
They require a separate disposable PostgreSQL database and must never point at `DATABASE_URL`.

Create the local test database once:

```bash
createdb -h 127.0.0.1 -p 5432 -U postgres babyloop_test
```

Run the API integration suite:

```bash
export TEST_DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5432/babyloop_test"
pnpm --filter @babyloop/api test
```

The test setup resets the `drizzle` and `public` schemas inside `babyloop_test`, runs migrations,
and creates its own data for auth, listings, favorites, messaging, and mock AI audit logging checks.

## Auth Notes

Current auth is a local-first email/password implementation:

- `AUTH_SECRET` is required when `DATABASE_URL` is configured and must be at least 32 characters.
- Default access token TTL is 15 minutes; set `AUTH_TOKEN_TTL_SECONDS` only for local dev overrides.
- `AUTH_RATE_LIMIT_MAX` and `AUTH_RATE_LIMIT_WINDOW_SECONDS` apply to register/login endpoints.
- Web token storage currently uses `localStorage`; HTTP-only cookies, refresh tokens, session tables,
  email verification, and password reset are intentionally delayed production hardening items.
- `ALLOW_AUTH_UNAVAILABLE=true` is only for local unavailable-mode testing.

The mock AI endpoint writes to `ai_model_runs` when `DATABASE_URL` is configured. If database logging is unavailable, the suggestion response should still work.

Optional API CORS override:

```bash
CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000 pnpm --filter @babyloop/api dev
```
