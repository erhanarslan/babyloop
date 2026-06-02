# BabyLoop Validation and Regression Checklist

## Purpose

This checklist defines the minimum validation gate before BabyLoop changes are considered safe to merge.

It is not a claim that every item is currently automated. Items are marked as automated command checks, API regression areas, manual web checks, or database review checks.

## Automated Validation Commands

Run from the repository root unless noted.

Required tooling:

- Node.js `>=22` (recommended local version: `22.13.1`)
- pnpm `10.33.0`

Verify before running validation:

```bash
node -v
pnpm -v
pnpm preflight
```

Known failure mode: Node `v20.11.0` is too old for the current Vitest/Rolldown toolchain. If tests fail before running because of `node:util.styleText`, Vitest startup, or Rolldown startup errors, switch to Node `>=22`.

| Area | Command | Notes |
| --- | --- | --- |
| Tooling preflight | `pnpm preflight` | Fails fast when Node.js or pnpm is unsupported. |
| Root typecheck | `pnpm typecheck` | Runs workspace typechecks through Turborepo. |
| Root build | `pnpm build` | Builds packages and apps through Turborepo. |
| Root test | `pnpm test` | Runs configured workspace tests. Currently API tests are the main automated suite. |
| API typecheck | `pnpm --filter @babyloop/api typecheck` | Verifies Fastify API and internal package imports. |
| API test | `pnpm --filter @babyloop/api test` | Requires `TEST_DATABASE_URL`; uses Vitest and `fastify.inject`. |
| Web typecheck | `pnpm --filter @babyloop/web typecheck` | Verifies Next.js app TypeScript. |
| Web build | `pnpm --filter @babyloop/web build` | Verifies Next.js production build. |
| Database typecheck | `pnpm --filter @babyloop/database typecheck` | Verifies Drizzle schema TypeScript. |
| Database schema check | `pnpm --filter @babyloop/database db:check` | Checks Drizzle migration/schema consistency. |

API tests require a disposable test database:

```bash
export TEST_DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5432/babyloop_test"
pnpm --filter @babyloop/api test
```

`pnpm test` and `pnpm validate` also require `TEST_DATABASE_URL` because the root test pipeline runs the API integration suite.

Tests must never use `DATABASE_URL`.

Do not run `pnpm test` and `pnpm --filter @babyloop/api test` in parallel against the same `TEST_DATABASE_URL`; the API integration suite resets the test database.

## API Regression Areas

These behaviors should stay covered by API tests or explicit manual API verification before risky backend changes.

### Auth

- [ ] register success
- [ ] duplicate email rejection
- [ ] normalized duplicate email rejection
- [ ] login success
- [ ] invalid password rejection
- [ ] `GET /api/v1/auth/me` is protected
- [ ] invalid token rejection
- [ ] auth rate limit

### Listings

- [ ] public active listing list
- [ ] inactive listing hidden from public list
- [ ] active listing detail
- [ ] inactive listing detail hidden
- [ ] unauthenticated create rejected
- [ ] authenticated create works
- [ ] authenticated create works for `sale`, `donation`, and `swap`
- [ ] create rejects `listingType: "rent"` with `INVALID_REQUEST`
- [ ] seller spoofing rejected
- [ ] my listings only returns owned listings
- [ ] invalid image URL is rejected
- [ ] more than 5 image URLs are rejected
- [ ] valid image URLs are stored in `sortOrder` order

### Favorites

- [ ] unauthenticated favorite rejected
- [ ] own listing cannot be favorited
- [ ] inactive listing cannot be favorited
- [ ] duplicate favorite is idempotent
- [ ] remove favorite is idempotent
- [ ] event logging works only when favorite state changes

### Messaging

- [ ] unauthenticated create rejected
- [ ] cannot message own listing
- [ ] conversation reused for same profile pair
- [ ] only participants can read thread
- [ ] non-participants blocked
- [ ] blank messages rejected
- [ ] `lastMessageAt` updated after sending a message
- [ ] `latestMessage` appears in conversation list when available

### AI

- [ ] mock suggestion response works
- [ ] `ai_model_runs` success log inserted when database logging is available
- [ ] AI suggestion response still works if logging fails or is unavailable

## Web Manual Regression Checklist

Run against the local API and web app after user-facing web changes.

Prerequisites:

- local PostgreSQL migrated and seeded
- API running with `DATABASE_URL`, `AUTH_SECRET`, and `PORT`
- web running with `BABYLOOP_API_BASE_URL`

Checklist:

- [ ] register
- [ ] login
- [ ] logout if available
- [ ] auth nav state
- [ ] browse
- [ ] listing detail
- [ ] create listing
- [ ] sell form does not show Rent
- [ ] create sale listing
- [ ] create donation listing
- [ ] create swap listing
- [ ] image URL field is marked temporary/development-only
- [ ] valid image URLs can still be submitted
- [ ] invalid image URL fails instead of silently creating bad image metadata
- [ ] favorite/unfavorite
- [ ] favorites page
- [ ] my listings page
- [ ] message seller
- [ ] conversations page
- [ ] conversation detail page
- [ ] send message

Seeded account flow:

1. Login as `ayse@example.com` / `Test123456`.
2. Open `/browse`.
3. Open Mehmet's seeded listing.
4. Favorite and unfavorite the listing.
5. Start a conversation from listing detail.
6. Send a message.
7. Logout.
8. Login as `mehmet@example.com` / `Test123456`.
9. Open `/conversations`.
10. Reply in the conversation thread.

## Database and Migration Safety Checklist

Review every schema or migration change before applying it to shared data.

- [ ] `pnpm --filter @babyloop/database db:check` passes
- [ ] migration does not add `NOT NULL` columns to non-empty tables without a backfill or safe default
- [ ] constraints have explicit names where practical
- [ ] foreign key delete behavior is intentional
- [ ] indexes exist for ownership/access queries
- [ ] migration SQL does not contain duplicate table creation blocks
- [ ] generated migration matches the Drizzle schema intent
- [ ] seed data remains idempotent

Ownership/access query examples that should stay indexed as the schema grows:

- current profile's listings
- current profile's favorites
- conversation participants
- conversation listing contexts
- messages by conversation and creation time

## Release Gate

Do not merge if:

- `pnpm typecheck` fails
- API tests fail
- `pnpm --filter @babyloop/database db:check` fails
- an API contract changed without documentation
- an auth ownership regression is found
- a public endpoint exposes inactive or private data
- manual QA critical path was not completed for a user-facing change
- a migration is unsafe for existing local or shared data

## Not Covered Yet

These areas are intentionally not marked as tested until infrastructure exists:

- browser E2E tests
- web component tests
- CI enforcement
- accessibility automation
- visual regression tests
- load/performance tests
