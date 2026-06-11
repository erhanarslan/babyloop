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
- [ ] owner can upload a valid JPEG/PNG/WEBP image
- [ ] unauthenticated upload is rejected
- [ ] non-owner upload/delete/reorder is rejected
- [ ] SVG is rejected
- [ ] fake `.jpg`/`.png` HTML or JS content is rejected
- [ ] MIME/extension/magic-byte mismatch is rejected
- [ ] oversized image is rejected
- [ ] more than 5 uploaded/listing images is rejected
- [ ] uploaded images are served only through the safe media route
- [ ] deleting an image removes the DB row and does not return 500 if file cleanup is best-effort
- [ ] reordering listing images returns the new `sortOrder`

### Favorites

- [ ] unauthenticated favorite rejected
- [ ] own listing cannot be favorited
- [ ] inactive listing cannot be favorited
- [ ] duplicate favorite is idempotent
- [ ] remove favorite is idempotent
- [ ] event logging works only when favorite state changes
- [ ] favorite notification does not expose actor display name, email, profile id, or user id
- [ ] listing detail and seller listing responses expose privacy-safe `favoriteCount`
- [ ] favorite/unfavorite updates `favoriteCount` without exposing who favorited the listing

### Messaging

- [ ] unauthenticated create rejected
- [ ] cannot message own listing
- [ ] conversation reused for same profile pair
- [ ] only participants can read thread
- [ ] non-participants blocked
- [ ] blank messages rejected
- [ ] unsafe HTML/script message bodies are rejected without a 500
- [ ] conversation list fetch does not mark unread messages or notifications as read
- [ ] notification list fetch does not mark unread notifications as read
- [ ] explicit conversation-read flow only marks the current user's relevant unread state
- [ ] `lastMessageAt` updated after sending a message
- [ ] `latestMessage` appears in conversation list when available

### Notifications

- [ ] auth required for notification list and unread count
- [ ] unread count increases after receiving a message notification
- [ ] unread count decreases after marking related message content read
- [ ] mark-one-read updates only the current user's notification
- [ ] mark-all-read updates only the current user's notifications

### Trust & Safety

- [ ] authenticated user can report another user's listing
- [ ] authenticated user can report another profile
- [ ] authenticated conversation participant can report a message
- [ ] unauthenticated report returns 401
- [ ] nonexistent report target returns 404
- [ ] invalid reason/details returns 400
- [ ] duplicate report by the same reporter/target is idempotent
- [ ] report creates a moderation case and safety event
- [ ] user can block another profile
- [ ] user cannot block themself
- [ ] block and unblock are idempotent
- [ ] blocked profile pair cannot start a new conversation
- [ ] blocked profile pair cannot send messages in either direction
- [ ] block/list responses do not expose private user data

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
- [ ] listing image file picker accepts PNG/JPEG/WEBP
- [ ] local image preview appears before submit
- [ ] valid uploaded image appears on listing detail
- [ ] valid uploaded image appears as browse thumbnail
- [ ] valid uploaded image appears as my-listings thumbnail
- [ ] seller can delete an uploaded image and listing detail updates
- [ ] non-owner cannot upload, delete, or reorder another seller's listing images
- [ ] SVG upload is rejected with friendly copy
- [ ] fake `.jpg` HTML upload is rejected with friendly copy
- [ ] oversized image is rejected with friendly copy
- [ ] sixth image is rejected or blocked with friendly copy
- [ ] valid image URLs can still be submitted as compatibility metadata
- [ ] invalid image URL fails instead of silently creating bad image metadata
- [ ] favorite/unfavorite
- [ ] favorite notification privacy remains intact
- [ ] favoriteCount updates after favorite/unfavorite
- [ ] favorites page
- [ ] my listings page
- [ ] message seller
- [ ] conversations page
- [ ] conversation detail page
- [ ] send message
- [ ] unsafe message body is rejected with friendly copy and no script executes
- [ ] messaging unread/read behavior only clears after conversation content is viewed
- [ ] notification unread count stays accurate after read/read-all and conversation-read flows
- [ ] report listing action submits successfully
- [ ] report user action submits successfully
- [ ] report message action submits successfully
- [ ] block user disables further sending from the current conversation
- [ ] unblock allows messaging to resume if the other side has not blocked the user
- [ ] mobile width check for listing image previews and messaging thread/composer

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


<!-- 2026-06-11-backoffice-privacy-redaction-foundation -->
## 2026-06-11 Update — Backoffice Data Privacy + Redaction Foundation

### Backoffice privacy regression checklist

Run this after every change touching:

- `apps/api/src/services/admin-moderation.service.ts`
- `apps/api/src/routes/admin-moderation.routes.ts`
- `apps/api/src/services/redaction.service.ts`
- `apps/backoffice/src/features/moderation/api.ts`
- moderation tests
- safety/report/message DTOs

### Targeted grep

```bash
grep -R "conversationId\|reporterDisplayName\|bodyPreview: message.body\|message.body.slice" -n \
  apps/api/src/services/admin-moderation.service.ts \
  apps/api/src/routes/admin-moderation.routes.ts \
  apps/backoffice/src/features/moderation/api.ts
```

Expected result after privacy patch:

```txt
No output.
```

### Message test fixture grep

```bash
grep -n "conversationId\|conversation.id" apps/api/test/admin-moderation.integration.test.ts
```

Expected result:

```txt
conversationId: conversation.id
expect(serialized).not.toContain(conversation.id)
```

The first line is fixture setup. The second line is leak regression.

### Required targeted tests

```bash
pnpm --filter @babyloop/api test -- redaction.service.test.ts admin-moderation.schemas.test.ts admin-moderation.integration.test.ts
```

### Required typechecks

```bash
pnpm --filter @babyloop/api typecheck
pnpm --filter @babyloop/backoffice typecheck
pnpm typecheck
```

### Required build

```bash
pnpm build
```

### Sensitive access checklist

Default moderation list/detail responses must remain redacted.

`POST /api/v1/admin/moderation/cases/:caseId/sensitive-access` must verify:

- missing reason returns 400
- too-short reason returns 400
- empty fields returns 400
- invalid fields returns 400
- non-admin returns 403
- unknown case returns 404
- only requested/granted fields are returned
- raw reporter data is available only when `reporter` is requested
- raw message body is available only when `message` is requested for a message case
- response includes `auditEventId`
- successful access creates an `events` audit row
- denied non-admin access creates an `admin_sensitive_access_denied` audit row when the actor and case are known
- denied invalid-body access creates an `admin_sensitive_access_denied` audit row when the actor and case are known
- requested fields unavailable for a case create an `admin_sensitive_access_denied` audit row
- denied audit metadata does not contain raw message body, reporter email, tokens, or full profile/listing/conversation data
- response does not include conversation participants, full profile data, full listing data, or auth/session metadata
- unauthenticated requests and malformed case ids may return safe errors without DB audit rows because actor/case context is unavailable

The public web app must not import or call the sensitive-access client.

The backoffice must not request sensitive access automatically when a case detail loads.

### Backoffice sensitive access UI checklist

- [ ] moderation case detail loads with default redacted data only
- [ ] sensitive access panel is collapsed behind an explicit action
- [ ] opening the panel does not call the sensitive-access endpoint
- [ ] submit is disabled until a reason of at least 10 characters is entered
- [ ] submit is disabled until at least one field is selected
- [ ] request warning is visible before submit
- [ ] successful request displays only returned/granted fields
- [ ] successful request displays `Audit event id`
- [ ] clear button removes returned sensitive data from component state
- [ ] sensitive data is not placed in URL params, localStorage, sessionStorage, cookies, or console logs
- [ ] public web app still has no sensitive-access client import

### PII response assertions

Admin moderation responses must not contain:

```txt
reporter email
reporter profile id
reporter display name
phone numbers
email addresses
raw message body
conversation id
conversation participant ids
```

Allowed redaction markers:

```txt
[redacted-email]
[redacted-phone]
reporter.redacted = true
```

### Manual smoke test

1. Start stack:

```bash
./scripts/dev-clean-start.sh
```

2. Open:

```txt
http://localhost:3001/moderation
```

3. Open a moderation case detail.

4. Confirm:

- Case list loads.
- Case detail loads.
- Message preview is visible when target is message.
- Raw phone/email does not appear in preview.
- Reporter identity is not visible.
- Status update still works.
- Note/action creation still works.
