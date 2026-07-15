# BabyLoop

BabyLoop is a safe, intelligent, family-focused second-hand marketplace for baby/child products.

This repository currently contains a verified local/product foundation moving toward full production readiness:

- pnpm workspaces
- Turborepo
- TypeScript
- `apps/web`: Next.js app with home, browse, listing detail, sell, favorites, my listings, auth, notifications, and messaging pages
- `apps/api`: Fastify API with health, auth, marketplace listings, image upload, favorites, notifications, mock AI listing suggestions, messaging, and backoffice admin endpoints
- `packages/shared`: shared API response type
- `packages/config`: shared app constants
- `packages/database`: Drizzle/PostgreSQL schema, migration, local seed data, and `ai_model_runs` audit table
- `packages/ai-core`: deterministic mock listing suggestion provider

The current auth slice includes email/password register/login, `GET /api/v1/auth/me`, refresh-token sessions, logout/session revoke, password reset, email verification, Google OAuth foundation, and MFA OTP backend foundation. These are local/product foundations, not a claim of production-ready auth operations.

Worker, mobile app, listing valuation, RAG, recommendations, production email delivery, payments, and production AI operations are intentionally delayed. A configurable OpenAI-backed provider foundation now exists for redacted backoffice moderation summaries; public listing assistance remains mock-only.

## Current Implemented Features

Implemented:

| Area | Current state |
| --- | --- |
| Auth | Email/password register/login, `GET /api/v1/auth/me`, refresh-token sessions, logout/session revoke, password reset, email verification, Google OAuth foundation, MFA OTP backend foundation, and basic auth rate limiting. |
| Listings | Public active/reserved listing list/detail, authenticated listing creation for `sale`, `donation`, and `swap`, seller-owned edit/status lifecycle, authenticated `/api/v1/me/listings`, web browse/detail/sell/my-listings pages. |
| Listing images | Local listing image upload, magic-byte/MIME/extension validation, local `var/uploads` storage, safe media serving, delete/reorder API, and retained manual URL compatibility. |
| Favorites | Authenticated favorite/unfavorite/list API and web UI. Users cannot favorite their own listings or inactive listings. Favorite notifications hide actor identity, and listing responses expose privacy-safe `favoriteCount`. |
| Notifications | Persistent in-app notifications, unread count, mark-read/read-all APIs, realtime notification events, notification center, and header unread badge. |
| Messaging | Authenticated conversation API, idempotent start-conversation behavior, web conversations list, web thread page, deterministic moderation, stored-XSS plaintext safety, explicit/visibility-based read state, Socket.IO realtime delivery, and plain text send UI. Conversations are one channel per profile pair with listing contexts. |
| Trust & Safety | Report listing/profile/message APIs, user block/unblock APIs, two-way messaging restrictions for blocked profile pairs, profile safety enforcement foundation, moderation case foundation, safety event logging, and minimal web entry points. |
| Backoffice | Dedicated admin app with cookie-backed auth, dashboard MVP, moderation list/detail/timeline/enforcement, profile enforcement controls, sensitive-access request UI, listing review, listing image approve/reject, safe audit browser, and aggregate operations summary. |
| Mock AI | Deterministic mock listing suggestion provider, API endpoint, sell-page integration, and `ai_model_runs` logging when DB is available. |
| Tests | API integration tests with Vitest and `fastify.inject`. |

Partially implemented:

| Area | Current limitation |
| --- | --- |
| Auth/session | Session, logout, password reset, email verification, Google OAuth foundations, and backoffice httpOnly access-cookie transport exist, but public-web cookie migration, CSRF token enforcement, device/session management UI, provider validation, and deployment validation remain incomplete. |
| Listing discovery | Public list/detail exists, but search/filter/pagination are limited or missing. |
| Listing images | Local upload/storage works for development and tests, but production object storage, image transforms, EXIF stripping, CDN/cache strategy, upload rate limits, and image moderation are deferred. |
| Messaging | List/thread/send/realtime/read-state works, but attachments and durable per-conversation read receipts remain deferred. |
| Trust & Safety | Reporting/blocking, profile enforcement, backoffice review, safe audit browsing, and explicit redacted AI moderation summary foundations exist. Assignment/SLA, fraud detection, appeals, unsafe-product guidance, full user directory, trust-score snapshots, and monitoring analytics are deferred. |
| AI | Mock public listing suggestion flow exists. Backoffice redacted moderation summaries support mock or server-configured OpenAI provider execution with guardrails and `ai_model_runs` logging. Listing image understanding, price recommendation, RAG, recommendation engine, summary history, rate limiting, and cost monitoring remain deferred. |
| Realtime | Socket.IO works locally for messaging/notifications, but production scaling with a Redis adapter remains deferred. |
| Email | No-op/dev email flow exists; real provider delivery is deferred. |
| Web testing | API integration tests exist; web component/E2E tests are still missing. |

Not implemented:

- rental listing flows
- mobile app
- payments
- full assignment/SLA moderation workflow
- production observability/deployment pipeline

Intentionally deferred:

- worker and mobile apps
- public listing AI provider, pricing/valuation, image understanding, RAG, recommendations, and production AI operations
- background workers/automation and notification delivery expansion
- remaining production-grade auth/session hardening, including CSRF token enforcement and device/session UI
- WhatsApp-like chat UI refinement as a future UX direction, not WhatsApp integration
- hybrid payment model: external agreement mode plus optional safe payment mode
- admin-managed pinned promo cards in conversations

## Install

BabyLoop requires:

- Node.js `>=22` (recommended local version: `22.13.1`)
- pnpm `10.33.0` via `packageManager`

Verify your local tooling:

```bash
node -v
pnpm -v
pnpm preflight
```

Known tooling issue: Node `v20.11.0` is too old for the current Vitest/Rolldown test toolchain. If tests fail before running with `node:util.styleText`, Vitest, or Rolldown startup errors, switch to Node `>=22` and reinstall if needed.

```bash
pnpm install
```

## Local Infrastructure

Docker Compose runs local dependencies only. Web and API still run with pnpm on the host machine.

```bash
pnpm dev:infra
```

This starts PostgreSQL on `5432` and Redis on `6379`.

Stop the dependency stack:

```bash
pnpm dev:infra:down
```

Reset local dependency volumes:

```bash
pnpm dev:infra:reset
```

Use `.env.example` for local placeholders. Do not commit real secrets.

Listing image uploads use local runtime storage by default:

```bash
UPLOAD_ROOT=var/uploads
```

`var/uploads/` is ignored by git. PostgreSQL stores image metadata and API-relative URLs, not raw image bytes. Local upload validates MIME type, extension, magic bytes, size, count, and ownership. Production object storage, transforms/resizing, EXIF stripping, CDN/cache strategy, upload rate limits, and image moderation are still missing. See [docs/30-listing-image-upload-and-safety.md](/Users/erhan-pc-mac/Desktop/babyloop/docs/30-listing-image-upload-and-safety.md) for safety rules and the future R2/S3 migration path.

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

Run these under Node.js `>=22`. Start with `pnpm preflight` so unsupported local tooling fails before typecheck/build/test.

```bash
pnpm preflight
pnpm typecheck
pnpm build
pnpm test
pnpm --filter @babyloop/api test
pnpm --filter @babyloop/api typecheck
pnpm --filter @babyloop/web typecheck
pnpm --filter @babyloop/database typecheck
pnpm --filter @babyloop/database db:check
```

You can run the full local gate with:

```bash
pnpm validate
```

Because `pnpm validate` runs tests, export `TEST_DATABASE_URL` before using it.

Do not run root/API test commands in parallel when they share the same `TEST_DATABASE_URL`; the test suite resets that database.

Use [docs/25-validation-and-regression-checklist.md](/Users/erhan-pc-mac/Desktop/babyloop/docs/25-validation-and-regression-checklist.md) as the merge-safety checklist for API, web, and database regression checks.

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

1. Start the local dependency stack or confirm PostgreSQL is running:

```bash
pnpm dev:infra
```

or:

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
- Edit the listing title or price from `/my-listings`.
- Mark the listing reserved and confirm it remains visible in `/browse`.
- Reactivate the reserved listing.
- Mark the listing sold or archived and confirm it no longer appears in default browse.
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
- rental deposit/date range/return/damage/contract flows
- image upload/storage and media validation
- search/filter/pagination
- messaging unread state, report, and block flows
- deeper admin/moderation tools beyond the current backoffice foundation
- trust and safety policy enforcement
- deployment and observability

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
- Public web token storage currently uses Bearer-token compatibility; backoffice access-token storage has moved to httpOnly cookies. Full public-web cookie migration, richer session/device management,
  production email delivery, provider validation, and deployment hardening remain incomplete.
- `ALLOW_AUTH_UNAVAILABLE=true` is only for local unavailable-mode testing.

The mock AI endpoint writes to `ai_model_runs` when `DATABASE_URL` is configured. If database logging is unavailable, the suggestion response should still work.

## Listing Lifecycle

Listings support `active`, `reserved`, `sold`, and `archived` seller lifecycle states.
Default browse/detail shows `active` and `reserved` listings. Sold and archived listings are hidden from public browse/detail and block new conversation creation.
Existing conversations remain readable for participants after a listing changes status.

See [docs/28-listing-lifecycle-and-platform-foundation.md](/Users/erhan-pc-mac/Desktop/babyloop/docs/28-listing-lifecycle-and-platform-foundation.md) for lifecycle rules, endpoint contracts, Docker Compose usage, and CI scope.

## Image Upload Status

Local listing image upload is now the primary development/test image flow. Manual `imageUrls` are still supported as a temporary compatibility bridge.
Neither local disk upload nor manual URLs are a production listing image storage strategy.

Future production upload work should add:

- signed upload URLs
- durable object storage
- transforms/resizing
- EXIF stripping
- CDN/cache strategy
- upload rate limits
- moderation/safety checks before broad marketplace distribution

Optional API CORS override:

```bash
CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000 pnpm --filter @babyloop/api dev
```


AI moderation summaries now support a default mock provider plus optional server-side OpenAI Responses provider configuration. See `docs/40-ai-moderation-provider-configuration.md` for guardrails and environment settings.
