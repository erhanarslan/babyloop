# BabyLoop Stabilization Roadmap

## Purpose

BabyLoop has reached a point where continuing to add features without stabilization will create architectural drift.

This roadmap defines how the current gaps should be fixed step by step.

## Current Situation

BabyLoop currently has a working local full-stack foundation:

- PostgreSQL database
- Drizzle schema and migrations
- Fastify API
- Next.js web app
- auth foundation
- listings
- favorites
- mock AI listing suggestions
- messaging API foundation
- messaging web UI foundation
- API integration tests with Vitest

Current stabilization concerns:

- API integration tests exist, but web/E2E/CI coverage is still missing.
- auth is local-MVP level, not production-grade.
- web UI is functional but not polished.
- production readiness is low.
- messaging docs must stay aligned with the profile-pair model.
- local validation requires Node.js `>=22`; Node `v20.11.0` is too old for the current Vitest/Rolldown test toolchain.

## Stabilization Rule

Until the current foundation is stable, do not add:

- admin panel
- mobile app
- real AI provider
- image upload pipeline
- payments
- notifications
- full UI redesign
- moderation queue
- realtime messaging
- background workers

## Phase 1: Contract Stabilization

Public API request/response keys use `camelCase`.

Confirmed current direction:

- listing creation uses `categoryId`, `priceAmount`, `listingType`, `imageUrls`.
- `imageUrls` is temporary development-only image metadata until real upload exists.
- favorites use `listingId`.
- messaging uses `listingId` only as listing context input.

Database table and column names remain `snake_case`.

## Phase 2: Messaging Stabilization

Canonical model:

- exactly one conversation channel between two profiles.
- `conversations` uses normalized profile-pair columns: `profile_low_id`, `profile_high_id`.
- listings are attached through `conversation_listing_contexts`.
- `conversation_participants` remains for access checks and future flexibility.
- `messages` stores plain text messages.

The old listing-based conversation model is deprecated.

## Phase 3: Validation and Tests

Already present:

- API integration tests under `apps/api/test`.
- Vitest API tests use `fastify.inject`.
- Auth, listings, favorites, messaging, and mock AI have API-level coverage.

Recommended next stabilizers:

- add CI execution for existing validation commands.
- add web component or E2E tests for browser-owned flows.
- add migration safety notes before shared DB usage.
- resolve the production migration risk documented in `docs/26-database-migration-safety-audit.md`, especially the messaging profile-pair backfill path.
- use `docs/27-messaging-migration-backfill-plan.md` to choose between pre-production baseline cleanup and forward-only staged migration before any shared production-like data is migrated.
- document local dev verification flows.

Use `docs/25-validation-and-regression-checklist.md` as the detailed regression gate for stabilization work.

## Productization Blockers

- production-grade auth/session transport
- Google OAuth
- listing edit/archive/delete lifecycle
- image upload/storage
- signed upload URLs, storage, file type validation, and file size limits
- search/filter/pagination
- messaging unread/realtime/report/block flows
- admin/moderation
- trust and safety
- CI/deployment/observability

## Validation Commands

Run validation under Node.js `>=22` with pnpm `10.33.0`. Use `pnpm preflight` before validation to fail fast on unsupported local tooling.

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

`pnpm validate` runs the local gate in order: preflight, typecheck, build, then tests.

Because it runs tests, `pnpm validate` requires `TEST_DATABASE_URL`.

Do not run root/API tests in parallel against the same `TEST_DATABASE_URL`; they reset the shared test database.

## Manual QA Baseline

- register
- login
- browse listings
- listing detail
- create listing
- favorite/unfavorite
- view favorites
- my listings
- start conversation from listing detail
- open conversations list
- open conversation thread
- send message

## Do Not Regress

- Do not revert messaging to listing-based conversations.
- Do not create separate conversations per listing.
- Do not remove `conversation_listing_contexts`.
- Do not reintroduce snake_case API request bodies such as `listing_id`.

## Delayed Work

Do not include in stabilization-only tasks:

- realtime messaging
- message moderation
- reporting/blocking
- notifications
- admin UI
- mobile UI
- real AI providers
- payments
