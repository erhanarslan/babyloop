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
- listing image upload/storage
- favorites
- notifications
- mock AI listing suggestions
- messaging API/web/realtime foundation
- Trust & Safety report/block/moderation foundation
- API integration tests with Vitest

Current stabilization concerns:

- API integration tests and CI exist, but web/E2E coverage is still missing.
- auth/session foundation exists, but production hardening is not complete.
- web UI is functional but not polished.
- production readiness is low.
- messaging docs must stay aligned with the profile-pair model.
- local validation requires Node.js `>=22`; Node `v20.11.0` is too old for the current Vitest/Rolldown test toolchain.

## Stabilization Rule

Treat the current codebase as a working foundation. Future work should move through the phases below deliberately instead of jumping into unrelated product areas. Keep API contracts documented, keep database migrations safe, and keep privacy/security fixes intact.

Stable contracts to preserve:

- public API request/response keys use `camelCase`.
- database table and column names remain `snake_case`.
- listing creation still accepts `categoryId`, `priceAmount`, `listingType`, and compatibility `imageUrls`.
- local file upload is now the preferred listing image path for development and tests.
- favorites use `listingId`.
- messaging uses `listingId` only as listing context input.
- conversations are one channel per profile pair, with listing context attached through `conversation_listing_contexts`.
- message bodies remain safe plaintext.

## Recommended Sequence

### Phase 0: Cleanup and Manual QA

- finish stale documentation cleanup.
- run manual QA for auth, listing lifecycle, image upload, favorites, notifications, messaging, realtime, and mobile-width checks.
- add web/E2E tests only after the manual critical path is stable enough to encode.

### Phase 1: Trust & Safety / Report / Block / Moderation Foundation

- report listing/user/message flows. Foundation implemented.
- block user behavior. Foundation implemented.
- moderation case data model and API foundation. Foundation implemented.
- preserve favorite actor privacy and plaintext messaging safety.
- full admin review workflow, fraud detection, appeal flow, and AI/image moderation remain future work.

### Phase 2: Admin Foundation

- admin/backoffice auth boundary.
- moderation queue review tools.
- safe audit views for reports, listings, users, and messages.

### Phase 3: Account Security Panel

- user-facing session/device management.
- stronger auth/session transport.
- production email provider integration for verification and reset flows.
- Google OAuth production validation.
- MFA management UI if the backend foundation is kept.

### Phase 4: Search and Discovery

- filters, pagination, saved search, and ranking foundations.
- keep sold/archived listings hidden from default public browse.

### Phase 5: Seller Dashboard

- seller listing health, favoriteCount, message activity, and lifecycle summaries.
- keep favorite users private.

### Phase 6: UI Redesign and Mobile-First Pass

- product-wide visual system.
- mobile-first flows for browse, listing creation/upload, notifications, and messaging.
- WhatsApp-like chat UX direction without WhatsApp integration.

### Phase 7: Hybrid Payment

- external agreement mode.
- optional safe payment mode.
- no payment/escrow work before trust, admin, and account security basics exist.

### Phase 8: AI Intelligence Layer

- real provider integration.
- listing valuation and quality suggestions.
- safety-aware AI moderation assistance.

### Phase 9: Infrastructure and Workers

- Redis-backed queues.
- Socket.IO Redis adapter.
- rate-limit storage, background jobs, observability, and production deployment hardening.

### Phase 10: RAG and Mobile

- recommendation/RAG layer.
- native mobile app exploration after web/product foundations are steadier.

Use `docs/25-validation-and-regression-checklist.md` as the detailed regression gate for stabilization work.

## Productization Blockers

- production-grade auth/session transport
- R2/S3-compatible image storage migration, transforms, EXIF stripping, CDN/cache strategy, upload rate limits, and image moderation
- search/filter/pagination
- messaging report/block flows
- admin/moderation
- trust and safety
- deployment/observability

## Current Follow-ups

- Phase 0 cleanup and manual QA.
- Trust & Safety/report/block/moderation foundation.
- Admin foundation.
- Account security panel.
- Search/discovery.
- Seller dashboard.
- Mobile-first UI pass.
- Hybrid payment.
- AI intelligence layer.
- Infrastructure/workers.
- RAG/mobile.

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

- reporting/blocking
- admin UI
- mobile UI
- real AI providers
- payments


<!-- 2026-06-11-backoffice-privacy-redaction-foundation -->
## 2026-06-11 Update — Backoffice Data Privacy + Redaction Foundation

### Current stabilization track

```txt
Backoffice Data Privacy + Redaction Foundation
```

This is a stabilization/security task, not a UI polish task.

### Immediate checklist

1. Add API redaction utility.
2. Apply safe preview generation to moderation target previews.
3. Redact reporter identity in default admin moderation responses.
4. Remove reporter profile join from admin moderation list query.
5. Remove `conversationId` from default message preview DTO.
6. Update backoffice raw DTO types.
7. Add regression tests for PII exposure.
8. Add redaction utility unit tests.
9. Update docs with privacy contract.
10. Run targeted and full validation.

### Validation order

```bash
pnpm --filter @babyloop/api test -- redaction.service.test.ts admin-moderation.integration.test.ts
pnpm --filter @babyloop/api typecheck
pnpm --filter @babyloop/backoffice typecheck
pnpm typecheck
pnpm build
```

### Do not do in this track

- UI redesign
- AI moderation summary generation
- Raw sensitive-data access endpoint
- Permission matrix implementation
- New DB migration for audit logs
- Public marketplace feature work

These come after the redacted DTO foundation is stable.
