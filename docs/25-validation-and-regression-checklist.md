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
- [ ] backoffice admin login sets httpOnly access cookie and does not return `accessToken`
- [ ] backoffice non-admin login returns 403 and does not issue a usable access cookie
- [ ] backoffice refresh rotates cookies and does not return `accessToken`
- [ ] auth plugin accepts the explicit backoffice access cookie
- [ ] backoffice logout clears the access cookie and refresh cookie
- [ ] public auth login/refresh Bearer-token compatibility remains intact

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
- [ ] same image content cannot be uploaded twice to the same listing
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

### Backoffice Listing Review

- [ ] admin can list marketplace listings through `GET /api/v1/admin/listings`
- [ ] non-admin users cannot list admin listings
- [ ] admin listing list filters validate `status`, `q`, `categoryId`, `sort`, and `limit`
- [ ] admin listing list response does not expose seller email, seller phone, raw user/profile data, reporter identity, or raw message body
- [ ] admin can open listing detail through `GET /api/v1/admin/listings/:listingId`
- [ ] listing detail includes read-only image review metadata and related moderation case summaries
- [ ] related moderation case summaries do not expose reporter identity or raw message bodies
- [ ] admin can archive a listing with a reason through `POST /api/v1/admin/listings/:listingId/actions`
- [ ] admin can restore an archived listing with a reason
- [ ] listing admin actions write `admin_listing_action_applied` audit events
- [ ] unsupported listing actions and blank reasons are rejected
- [ ] admin can reject a listing image with a reason
- [ ] rejected images disappear from public listing list/detail responses
- [ ] admin listing detail still shows rejected images with `reviewStatus = rejected`
- [ ] admin can approve a rejected listing image
- [ ] approved images appear in public listing list/detail responses again
- [ ] listing image review writes `admin_listing_image_review_applied`
- [ ] image review audit metadata does not include raw reason, seller email/phone, reporter identity, raw message body, tokens, or raw profile/user objects
- [ ] non-admin image review requests return 403
- [ ] mismatched `listingId`/`imageId` returns 404
- [ ] dashboard summary returns aggregate counts only
- [ ] dashboard summary does not expose seller/reporter/message/private user data or raw event metadata

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
- [ ] backoffice `/listings` loads with status/search/sort/limit controls
- [ ] backoffice listing cards show safe seller summary, thumbnail/count, and related case counts
- [ ] backoffice `/listings/[listingId]` shows safe listing detail, read-only image review, related cases, and listing action audit
- [ ] backoffice listing archive/restore requires a reason and does not call sensitive-access
- [ ] backoffice image approve/reject requires a reason and does not call sensitive-access
- [ ] rejected images are visible in backoffice and hidden publicly
- [ ] backoffice dashboard loads aggregate-only listing/image/moderation/action cards
- [ ] backoffice listing review does not show seller email/phone, reporter identity, or raw message body
- [ ] backoffice login does not create `localStorage` or `sessionStorage` access-token entries
- [ ] backoffice API calls use credentialed cookie auth instead of `Authorization: Bearer`

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

### Moderation triage filters checklist

- [ ] moderation list filters by `status`
- [ ] moderation list filters by `targetType`
- [ ] moderation list search matches safe fields such as case id, report id, target id, target type, status, or report reason/status
- [ ] search does not expose raw reporter identity, raw message body, conversation ids, participant ids, profile emails, tokens, or session metadata
- [ ] invalid filter values return 400
- [ ] sort options preserve redacted list responses
- [ ] limit is capped at 100
- [ ] summary cards/counts reflect the current safe result set
- [ ] the moderation list page does not call the sensitive-access endpoint

### Moderation timeline and audit visibility checklist

- [ ] case detail includes a safe timeline
- [ ] timeline shows case/report creation context
- [ ] timeline shows moderation notes/actions/status changes
- [ ] timeline shows sensitive-access granted events as safe metadata
- [ ] timeline shows sensitive-access denied events as safe metadata
- [ ] timeline metadata is allowlisted server-side
- [ ] timeline metadata does not include raw message body, reporter email, user email, phone numbers, tokens, refresh tokens, auth/session metadata, full profile/listing/conversation data, or conversation participants
- [ ] timeline UI filters work for all, actions, notes, sensitive access, and status
- [ ] timeline does not call the sensitive-access endpoint
- [ ] sensitive-access panel behavior remains explicit and unchanged

### Moderation enforcement checklist

- [ ] non-admin enforcement requests return 403
- [ ] enforcement requires a reason of at least 10 characters
- [ ] invalid enforcement actions return 400
- [ ] incompatible target/action combinations return 400
- [ ] listing hide archives the listing
- [ ] listing restore reactivates the listing
- [ ] message hide sets `deletedAt` and normal messaging responses no longer expose the hidden body
- [ ] message reviewed records an audited moderation action without changing raw message content
- [ ] enforcement writes `admin_moderation_enforcement` audit metadata with `enforcementAction`, `targetType`, `targetId`, and `resultingStatus`
- [ ] profile warn records an audited moderation action and does not change `profiles.safety_status`
- [ ] profile restrict sets `profiles.safety_status = restricted`
- [ ] profile suspend sets `profiles.safety_status = suspended`
- [ ] profile restore sets `profiles.safety_status = active`
- [ ] restricted/suspended profiles cannot create new listings
- [ ] restricted/suspended profiles cannot send messages
- [ ] suspended seller listings are hidden from public listing list/detail responses
- [ ] no-op profile enforcement transitions return 400 and do not write audit events
- [ ] enforcement appears in the safe case timeline
- [ ] enforcement responses and timeline metadata do not include raw message body, reporter email, user email, phone numbers, tokens, auth/session metadata, full profile/listing/conversation data, or conversation participants
- [ ] enforcement UI does not call the sensitive-access endpoint
- [ ] profile enforcement controls are shown only for profile-target moderation cases

### Audit browser checklist

- [ ] admin can open `/audit`
- [ ] non-admin cannot call `GET /api/v1/admin/audit/events`
- [ ] audit filters validate `eventType`, `entityType`, safe search, sort, and limit
- [ ] audit browser search is limited to safe ids and event/entity types, not raw metadata text
- [ ] audit browser metadata is allowlisted and does not return raw metadata wholesale
- [ ] audit browser does not show raw reason text, reporter email, user email, phone numbers, message body, tokens, password hashes, cookies, raw profile/listing/message objects, or auth/session internals
- [ ] audit browser links safely to related moderation cases and listings when ids are present

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

- [ ] S3/R2 storage contract tests cover store/delete/resolve without credential leakage.

## Storage MIME/magic-byte and metadata checks

- `validateListingImage` must compare file extension, declared MIME, and detected magic bytes.
- Listing image optimization must not preserve EXIF/metadata.
- Duplicate image content hashes must reject repeated images within the same listing.
- S3/R2 image storage contract must not expose credentials or raw object data.

### Backoffice image review automated guard

- [ ] `pnpm security:backoffice-image-review` passes.
- [ ] `BACKOFFICE_E2E_BASE_URL=http://localhost:3001 pnpm --filter @babyloop/backoffice exec playwright test e2e/listing-image-review.smoke.spec.ts --reporter=list` passes.
- [ ] Image review approve/reject remains listing-scoped and does not call sensitive-access.
- [ ] Image review E2E keeps private sentinels hidden from UI.
- [ ] Image review audit metadata remains allowlisted and excludes raw reason text, seller contact data, reporter identity, raw message bodies, tokens, cookies, password hashes, raw profile/user objects, object storage credentials, and raw image binary data.

### Listing image authenticity provider boundary

- [ ] `pnpm security:image-authenticity` passes.
- [ ] Mock provider remains local/test-only; mock/unavailable must not be accepted for production image authenticity enforcement.
- [ ] Production requires `LISTING_IMAGE_AUTHENTICITY_PROVIDER=gemini` and a server-side `GEMINI_API_KEY` or `GOOGLE_API_KEY`.
- [ ] Gemini provider failures return safe unavailable responses without leaking raw provider error bodies to clients.
- [ ] Upload decisions map safely: `allow`, `needs_review`, and `reject`.
- [ ] Rejected provider decisions reject upload with a safe `IMAGE_AUTHENTICITY_REJECTED` error.
- [ ] Unavailable provider decisions reject upload with a safe `IMAGE_AUTHENTICITY_UNAVAILABLE` error.
- [ ] Listing image authenticity audit/run metadata excludes raw image bytes, base64, raw prompt, raw provider output, API keys, tokens, cookies, password hashes, raw profile/user objects, and seller contact data.
- [ ] Backoffice AI Ops and listing image review show only safe provider/model/prompt/confidence/decision/reason/flag metadata.

### Cross-listing duplicate image boundary

- [ ] `pnpm security:cross-listing-duplicates` passes.
- [ ] Same listing duplicate image content is rejected with `DUPLICATE_LISTING_IMAGE`.
- [ ] Same listing duplicate rejection does not expose `contentHash`, `content_hash`, `sha256`, object keys, storage credentials, or raw image bytes.
- [ ] The database keeps `listing_images_content_hash_idx` for future review queries.
- [ ] The database uniqueness boundary remains `(listing_id, content_hash)`, not global `content_hash` uniqueness.
- [ ] Cross-listing duplicate image use is not hard-blocked across listings in this MVP.
- [ ] Cross-listing duplicate image use is not claimed as production fraud detection.
- [ ] Future cross-listing fraud signal work must include seller context, listing status/history, time window, perceptual hash or provider signal, admin audit, and appeal/manual review boundaries.
- [ ] Content hashes remain internal and are not exposed in public, owner, or admin DTOs.

### Mobile OTP/MFA P0 boundary

- [ ] `pnpm security:mobile-auth` passes.
- [ ] `pnpm test:mobile:p0` passes.
- [ ] Mobile access token persistence uses Expo `SecureStore`; no mobile auth token is stored in `AsyncStorage`, `localStorage`, or `sessionStorage`.
- [ ] Login that returns `mfaRequired` leaves the user unauthenticated until the e-mail OTP challenge is verified.
- [ ] MFA-required login does not store an access token before OTP verification.
- [ ] Invalid/expired/reused OTP responses stay safe and do not leak `accessToken`, `refreshToken`, `passwordHash`, `currentPassword`, raw session data, or OTP hashes.
- [ ] MFA enable/disable uses a current-password modal flow and CSRF-backed authenticated mutations.
- [ ] Mobile approval is for web login approval; mobile login must not require mobile approval for itself.
- [ ] Mobile login approval preference changes require current password.
- [ ] Login approval completion stores an access token only after approval completion succeeds.
- [ ] Mobile session cards redact token-like values from device/user-agent text.
- [ ] Mobile realtime uses the hydrated auth token only for socket auth and disconnects on logout/session cleanup.

### Mobile P0 release gate

- [ ] `pnpm release:mobile:p0` passes.
- [ ] `pnpm security:mobile-auth` passes.
- [ ] `pnpm test:mobile:p0` passes.
- [ ] `pnpm --filter @babyloop/mobile typecheck` passes.
- [ ] The gate remains deterministic and does not start Expo, run Maestro, require ADB, or claim real-device QA.
- [ ] Maestro smoke remains optional through the dedicated mobile E2E/smoke path.
- [ ] Real-device S22 manual QA remains separately tracked and is not represented as passed by `pnpm release:mobile:p0`.

### Mobile notification boundary

- [ ] `pnpm security:mobile-notifications` passes.
- [ ] `pnpm release:mobile:p0` includes `pnpm security:mobile-notifications`.
- [ ] Mobile notification list, unread count, mark-one-read, and mark-all-read use authenticated mobile fetch only.
- [ ] Mobile notification cards do not expose `accessToken`, `refreshToken`, `passwordHash`, raw e-mail values, cookies, or raw auth/session payloads.
- [ ] Child lifecycle generation remains in-app only and does not claim real email/push/n8n delivery.
- [ ] Child reminder notification cadence is a preference/draft boundary; it does not prove native push delivery.
- [ ] Notification delivery policy remains draft-only until delivery logs, deduplication, frequency limiting, idempotency, and admin audit are implemented.
- [ ] Saved-search notification generation may create in-app notifications only; it must not send email, push, or n8n webhooks.

### Notification delivery log foundation

- [ ] `pnpm security:notification-delivery-log` passes.
- [ ] `pnpm --filter @babyloop/api test test/notification-delivery-log.service.test.ts test/notification-delivery-policy.service.test.ts` passes.
- [ ] `notification_delivery_logs` migration/schema exists with a unique idempotency key.
- [ ] Delivery candidate logs store `dedupKey`, `frequencyWindowHours`, `deliveryAllowed=false`, `draftOnly=true`, and safe metadata only.
- [ ] Frequency window checks block duplicate candidate writes before a real sender is connected.
- [ ] Metadata sanitation drops raw e-mail, phone, token, password, cookie, OTP, raw body, and authorization fields.
- [ ] Real email/push/n8n delivery remains disabled until sender integration, retry policy, admin audit, and delivery-result transitions are implemented.

### Child reminder delivery candidate pipeline

- [ ] `pnpm security:child-reminder-delivery` passes.
- [ ] `pnpm --filter @babyloop/api test test/child-reminder-delivery-candidates.service.test.ts test/notification-delivery-log.service.test.ts test/notification-delivery-policy.service.test.ts` passes.
- [ ] Scheduled child reminders can be converted into `notification_delivery_logs` candidate records.
- [ ] Completed/cancelled reminders are skipped and do not create delivery candidates.
- [ ] Candidate records keep `deliveryAllowed=false` and `draftOnly=true`.
- [ ] Duplicate candidate creation is blocked by the frequency window/idempotency boundary.
- [ ] Metadata does not persist raw e-mail, token, OTP, password, cookie, authorization, raw body, or child free-text description values.
- [ ] This package does not enable email/push/n8n senders.

### Saved-search delivery candidate pipeline

- [ ] `pnpm security:saved-search-delivery` passes.
- [ ] `pnpm --filter @babyloop/api test test/saved-search-delivery-candidates.service.test.ts test/notification-delivery-log.service.test.ts test/notification-delivery-policy.service.test.ts` passes.
- [ ] Saved-search/listing matches can be converted into `notification_delivery_logs` candidate records.
- [ ] Candidate records use a stable savedSearchId/listingId source id.
- [ ] Candidate records keep `deliveryAllowed=false` and `draftOnly=true`.
- [ ] Duplicate candidate creation is blocked by the frequency window/idempotency boundary.
- [ ] Metadata does not persist raw e-mail, token, OTP, password, cookie, authorization, raw body, or unsafe saved-search/listing text.
- [ ] This package does not enable email/push/n8n senders.

### Notification delivery-log ops preview

- [ ] `pnpm security:notification-ops-preview` passes.
- [ ] `pnpm --filter @babyloop/api test test/admin-notification-ops.service.test.ts` passes.
- [ ] `pnpm --filter @babyloop/backoffice test src/features/notifications/notification-ops-page.test.tsx` passes.
- [ ] Backoffice notification ops preview exposes aggregate delivery-log totals by status, kind, and channel.
- [ ] Recent delivery-log preview rows show redacted source refs only.
- [ ] Preview does not expose metadata, idempotency key, dedup key, e-mail, token, cookie, authorization, or raw body.
- [ ] The preview does not enable email/push/n8n senders, queues, or provider calls.

### Notification delivery transition model

- [ ] `pnpm security:notification-delivery-transitions` passes.
- [ ] `pnpm --filter @babyloop/api test test/notification-delivery-transitions.service.test.ts test/admin-notification-ops.service.test.ts` passes.
- [ ] Draft-only transitions allow only safe candidate/block/skip flows.
- [ ] `sent/failed` transitions remain blocked until provider sandbox, retry/dead-letter policy, idempotency, and admin audit exist.
- [ ] Backoffice ops preview shows the transition model without exposing metadata, idempotency key, dedup key, e-mail, token, cookie, authorization, or raw body.
- [ ] The transition model does not enable email/push/n8n senders, queues, or provider calls.

### Native push readiness

- [ ] `pnpm security:notification-push-readiness` passes.
- [ ] `pnpm --filter @babyloop/api test test/notification-push-readiness.service.test.ts test/admin-notification-ops.service.test.ts` passes.
- [ ] Backoffice notification ops preview shows native push readiness.
- [ ] Push sender remains disabled: `deliveryAllowed=false`, `draftOnly=true`, `pushSenderEnabled=false`.
- [ ] Token registry and token collection remain disabled until explicit consent, validation, revocation, audit, and rate limits exist.
- [ ] Expo/Firebase/APNs provider calls, queues, n8n hooks, webhooks, or senders are not enabled.

### n8n workflow readiness

- [ ] `pnpm security:notification-n8n-readiness` passes.
- [ ] `pnpm --filter @babyloop/api test test/notification-n8n-readiness.service.test.ts test/admin-notification-ops.service.test.ts` passes.
- [ ] Backoffice notification ops preview shows n8n workflow readiness.
- [ ] n8n workflow remains disabled: `deliveryAllowed=false`, `draftOnly=true`, `n8nWorkflowEnabled=false`, `webhookCallsAllowed=false`.
- [ ] Webhook, queue, worker, retry, dead-letter, consent, rate limit, signed payload, and audit prerequisites are visible.
- [ ] Real n8n workflow, webhook, queue, email, push, provider calls, or senders are not enabled.

### Mobile real-device S22 QA

- [ ] `pnpm qa:mobile:s22` passes.
- [ ] `docs/56-mobile-real-device-s22-qa-checklist.md` is completed on a physical Galaxy S22 before beta release.
- [ ] OTP/MFA, auth/session refresh, logout, browse, listing detail, sell listing with image upload, favorites, messaging, reports/block, and child profile/reminder entry points are checked.
- [ ] Android bottom tab behavior is checked with navigation buttons/gesture bar hidden and visible.
- [ ] Push sender disabled and n8n workflow disabled readiness copy is verified on mobile/backoffice.
- [ ] No access token, refresh token, OTP, cookie, password, email, phone, or raw message body appears in UI/debug logs.

### Storage ops preview

- [ ] `pnpm security:storage-ops-preview` passes.
- [ ] `pnpm --filter @babyloop/api test test/admin-storage-ops-preview.service.test.ts` passes.
- [ ] `pnpm --filter @babyloop/backoffice test src/features/storage/storage-ops-page.test.tsx` passes.
- [ ] Backoffice storage ops preview shows external storage provider disabled.
- [ ] S3/R2 provider, signed upload, bucket delete, object copy, CDN purge, and queue worker remain disabled.
- [ ] Storage preview does not expose object keys, bucket credentials, signed URLs, access tokens, cookies, raw upload body, EXIF metadata, email, phone, or user contact data.
