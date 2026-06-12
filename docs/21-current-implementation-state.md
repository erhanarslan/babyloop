# BabyLoop Current Implementation State

## Purpose

This document records the actual implemented state of BabyLoop. It is not a wishlist and it does not claim production readiness.

## Project Status

BabyLoop is a local full-stack marketplace foundation with product-grade slices for auth, listings, favorites, messaging, notifications, tests, local infrastructure, and CI.

Implemented stack:

- pnpm workspace monorepo
- Turborepo
- TypeScript
- Next.js web app
- Fastify API
- PostgreSQL
- Drizzle ORM schema and migrations
- Docker Compose local dependencies
- GitHub Actions CI foundation
- API integration tests with Vitest
- shared unit tests for pure shared logic

Current maturity level:

```text
Local MVP foundation with several production-oriented building blocks
```

## Implemented Web Routes

- `/`
- `/browse`
- `/listings/[id]`
- `/sell`
- `/login`
- `/register`
- `/forgot-password`
- `/reset-password`
- `/auth/callback`
- `/auth/verify-email`
- `/auth/verify-email/request`
- `/favorites`
- `/my-listings`
- `/notifications`
- `/conversations`
- `/conversations/[id]`
- `/account/password`

## Current Implemented Features

| Area | Current state |
| --- | --- |
| Auth | Email/password register/login, `GET /api/v1/auth/me`, refresh-token sessions, logout/session revoke, password reset, email verification, Google OAuth foundation, MFA OTP backend foundation, and basic auth rate limiting. |
| Listings | Public active/reserved browse/detail, authenticated listing creation, seller-owned edit/status lifecycle, authenticated `/api/v1/me/listings`, and minimal web controls. |
| Listing images | Real local upload/storage now exists. API validates MIME, extension, magic bytes, size, count, and ownership; stores files under `var/uploads`; serves them from `/api/v1/uploads/listings/:listingId/:filename`; keeps manual image URL compatibility. |
| Favorites | Authenticated favorite/unfavorite/list API and web UI. Favorite notifications hide actor identity. Listing responses expose privacy-safe `favoriteCount`. |
| Notifications | Persistent in-app notification model, list, unread count, mark read, mark all read, realtime events, notification center, and header unread badge. |
| Messaging | Profile-pair conversations with listing contexts, idempotent start-conversation behavior, message send/list/detail, deterministic moderation, plaintext/XSS validation, Socket.IO realtime events, explicit/visibility-based read state, block-aware send/start restrictions, and web list/thread/composer UI. |
| Trust & Safety | Report listing/profile/message APIs, user block/unblock APIs, two-way messaging restriction for blocked profile pairs, profile safety status/enforcement foundation, moderation case foundation, safety event logging, and minimal web entry points. |
| Backoffice | Dedicated admin app with cookie-backed auth, dashboard MVP, moderation list/detail/filters/timeline/enforcement, profile enforcement controls, explicit sensitive-access request UI, listing review, listing image approve/reject, listing activity visibility, and safe audit browser. |
| Mock AI | Deterministic listing suggestion provider, API endpoint, sell-page integration, and `ai_model_runs` audit logging when DB is available. |
| Tests | Split API integration tests under `apps/api/test`, shared unit tests, Socket.IO smoke coverage, and CI-ready validation scripts. |

## Partially Complete

| Area | Current limitation |
| --- | --- |
| Auth/session | Session foundation and backoffice httpOnly access-cookie transport exist, but public-web cookie migration, CSRF token enforcement, device/session management UI, and deployment validation remain incomplete. |
| Email | Token flows exist, but delivery is no-op/dev only until a real provider is added. |
| Google OAuth | Foundation exists, but production client validation and environment rollout remain incomplete. |
| MFA | Backend OTP foundation exists; user-facing MFA management is deferred. |
| Listing discovery | Browse/detail exists with limited search. Filters, pagination, saved search, and ranking are deferred. |
| Image storage | Local upload/storage works. R2/S3-compatible object storage, CDN/cache strategy, EXIF stripping, image moderation, upload rate limits, and image transforms/resizing are deferred. |
| Messaging | Realtime, read state, and block-aware send/start restrictions work. Attachments and durable per-conversation read receipts are deferred. |
| Trust & Safety | Reporting/blocking, profile enforcement, backoffice review, safe audit browser, and redacted AI moderation summary foundations exist. Assignment/SLA, escalation workflow, fraud detection, appeal flow, unsafe baby product guidance, full user directory, trust-score snapshots, and monitoring analytics are deferred. |
| Realtime | Socket.IO works locally. Redis adapter/scaling, presence, and production topology are deferred. |
| AI | Mock public listing suggestion flow exists. Backoffice moderation summaries support mock or server-configured OpenAI provider execution with guardrails and `ai_model_runs` logging. Listing image analysis, valuation, RAG, recommendations, AI summary history, rate limiting, and cost monitoring are deferred. |
| Web tests | API tests exist. Web component/E2E coverage is deferred. |

## Not Implemented

- full assignment/SLA moderation workflow
- production email provider
- session/device management UI
- saved search
- image moderation
- web E2E tests
- advanced analytics/dashboard beyond the aggregate MVP
- public listing real provider and production AI operations
- AI valuation
- RAG/recommendations
- reviews/ratings
- payments/rental flow
- mobile app

## Implemented API Areas

- `GET /health`
- auth register/login/refresh/logout/me
- password reset and email verification foundation
- Google OAuth callback foundation
- categories
- public listing browse/detail
- protected listing create/update/status
- protected listing image upload/delete/reorder
- protected current-user listing list
- protected favorites add/remove/list
- protected notifications list/unread/read/read-all
- protected messaging conversation/message/read endpoints
- Socket.IO realtime messaging/notifications
- mock AI listing suggestions

## Listing Image Storage

Local image uploads use:

- `UPLOAD_ROOT`, defaulting to `var/uploads`
- `var/uploads/listings/<listingId>/<random-file-name>.<ext>`
- DB metadata in `listing_images`
- API-relative public URLs such as `/api/v1/uploads/listings/<listingId>/<file>.png`

The database does not store raw image bytes or base64.

Allowed upload types:

- JPEG
- PNG
- WEBP

Rejected:

- SVG
- GIF
- HTML/XML/PDF/JS
- unknown binary
- MIME/extension/magic-byte mismatches
- files over 5MB
- more than 5 images per listing

See `docs/30-listing-image-upload-and-safety.md`.

## Productization Blockers

- production auth/session hardening and device management
- real email delivery
- production Google OAuth validation
- production image storage: object storage migration, CDN/cache strategy, EXIF stripping, transforms/resizing, upload rate limits, and image moderation
- search filters and pagination
- full assignment/SLA moderation workflow
- Redis-backed realtime scaling
- saved search
- deeper admin tools beyond the current backoffice foundation
- payments/rental flow
- public listing real provider, RAG, valuation, and production AI operations
- web E2E tests
- production observability/deployment hardening

## Validation Commands

```bash
pnpm preflight
pnpm --filter @babyloop/api typecheck
TEST_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/babyloop_test pnpm --filter @babyloop/api test
pnpm --filter @babyloop/web typecheck
pnpm --filter @babyloop/web build
pnpm typecheck
pnpm build
```

## Manual QA Baseline

- register/login/logout
- password reset and email verification dev flows
- browse listings
- listing detail
- create listing with valid image upload
- reject invalid image upload
- my listings edit/status/image controls
- favorite/unfavorite and favorite privacy
- notifications list/read/read-all
- start conversation from listing detail
- open conversations list
- open conversation thread
- send safe message
- reject unsafe message body
- confirm unread count only drops after conversation content is viewed


<!-- 2026-06-11-backoffice-privacy-redaction-foundation -->
## 2026-06-11 Update — Backoffice Data Privacy + Redaction Foundation

### Current active task

```txt
Backoffice Data Privacy + Redaction Foundation
```

This task started after the dedicated backoffice moderation list/detail flow became functional with real case IDs.

### Confirmed current architecture

- `apps/web` is the public marketplace application.
- `apps/backoffice` is the dedicated internal backoffice application.
- `apps/api` is the shared backend.
- Backoffice moderation routes live in `apps/backoffice`, not in the public web app.
- Public web legacy admin URLs redirect to the backoffice app.

### Confirmed completed before this task

- Backoffice app exists and runs on port `3001`.
- Backoffice shell layout exists.
- Backoffice login/auth shell exists.
- Non-admin users receive forbidden state.
- Admin users can access backoffice.
- `/moderation` list route exists.
- `/moderation/[caseId]` detail route exists.
- Dynamic detail route is located at `apps/backoffice/src/app/moderation/[caseId]/page.tsx`.
- Moderation case detail opens with real case IDs.
- Case detail displays core moderation metadata, target preview, status form, action/note form, and audit timeline.

### Current privacy/security work

The current implementation is stabilizing a server-side privacy boundary for admin moderation responses.

In progress:

- API redaction utility.
- Server-side safe text preview generation.
- Reporter identity redaction.
- Query-level reporter minimization.
- Message preview DTO minimization.
- Backoffice raw DTO update.
- PII exposure regression tests.
- Redaction utility unit tests.
- Documentation update.

### Current expected validation

```bash
pnpm --filter @babyloop/api test -- redaction.service.test.ts admin-moderation.integration.test.ts
pnpm --filter @babyloop/api typecheck
pnpm --filter @babyloop/backoffice typecheck
pnpm typecheck
pnpm build
```

### Not done yet

- Granular permission matrix for raw PII access beyond the current admin compatibility gate.
- AI moderation summary endpoint.
- AI recommendation workflow.
- Safe audit browser.
- Assignment/SLA workflows.
- Backoffice UI polish.


See also: `docs/40-ai-moderation-provider-configuration.md` for the AI moderation provider configuration and redaction guardrails.
