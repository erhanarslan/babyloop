# Current Backlog and Next Steps

## Purpose

This document keeps the BabyLoop backlog aligned with the actual codebase so future work starts from true project state.

## Product Vision

BabyLoop is a safe, intelligent, family-focused second-hand marketplace for baby/child products.

## Completed Or Mostly Completed

- pnpm monorepo
- Turborepo
- Next.js web app
- Fastify API
- PostgreSQL with Drizzle schema and migrations
- Docker Compose local dependencies for PostgreSQL and Redis
- GitHub Actions CI foundation
- split API integration tests
- shared unit tests
- auth register/login/me
- refresh-token session foundation
- logout/session revoke
- password reset
- email verification
- Google OAuth foundation
- MFA OTP backend foundation
- categories
- listing browse/detail/create/edit/status lifecycle
- local listing image upload/storage/safety
- my listings
- favorites
- favorite notification privacy
- privacy-safe favoriteCount
- notifications foundation
- notification unread/read/read-all
- messaging conversations/messages
- start-conversation idempotency
- realtime messaging and notifications
- messaging read-state correction
- messaging XSS/security hardening
- Trust & Safety report/block/moderation foundation
- deterministic message moderation
- mock AI listing suggestions
- AI audit logging

## Partially Complete

- production auth/session hardening
- real email delivery
- Google OAuth production validation
- MFA user-facing management
- listing discovery/filtering
- image handling beyond local storage: object storage, transforms, EXIF stripping, CDN/cache strategy, upload rate limits, and image moderation
- full moderation review workflow beyond report/block foundation
- realtime production scaling
- AI production/provider/RAG features
- UI system
- web tests/E2E

## Production Blockers

- production-safe auth/session transport and device/session UI
- real email provider
- verified Google OAuth deployment config
- R2/S3-compatible image storage, transforms, EXIF stripping, CDN/cache strategy, upload rate limits, and image moderation
- full moderation queue/admin review
- search filters/pagination
- web E2E tests
- observability and production deployment hardening

## Next P0 Tasks

- Complete Phase 0 cleanup and manual QA for auth, listing lifecycle, local image upload, favorites, notifications, messaging, realtime, and mobile-width checks.
- Harden the report/block foundation with manual QA and edge-case copy.
- Add admin/moderation review UI and workflow on top of the moderation case foundation.
- Move image storage from local disk to an S3/R2-compatible provider without changing public API contracts.
- Add image moderation and safer image processing/metadata handling.
- Add production email delivery.
- Add web E2E tests for auth, listing create/upload, favorites, notifications, and messaging.

## Product Foundation Roadmap

P0:

- Phase 0 cleanup/manual QA.
- Trust & Safety: report/block/moderation foundation. Implemented as a backend/API/minimal-web foundation; deeper review workflows remain.
- Admin/backoffice moderation foundation.
- Account security panel for sessions/devices, production email, Google OAuth validation, and MFA management.

P1:

- Search/discovery with filters, pagination, saved search, and ranking.
- Seller dashboard with listing lifecycle, favoriteCount, and messaging activity summaries.
- Mobile-first UI pass, including a WhatsApp-like chat UI direction. This is a UX direction, not WhatsApp integration.
- Hybrid payment model: external agreement mode plus optional safe payment mode.

P2:

- AI recommendation and intelligence layer with real provider support.
- AI ops/workers for asynchronous suggestions, moderation assistance, and auditability.
- RAG/recommendation layer after the core marketplace data and trust foundations are stable.
- Mobile app exploration after web flows and trust foundations mature.
- Future admin-managed pinned promo cards in conversations.

## P1/P2 Future Features

- saved search
- improved search filters and pagination
- Redis-backed Socket.IO adapter and queues
- notification delivery expansion
- analytics/dashboard
- reviews/ratings
- payment/secure checkout
- rental/date/deposit flow
- real LLM provider
- AI valuation
- RAG/recommendations
- mobile app

## Manual QA Checklist

- register/login/logout
- password reset dev flow
- email verification dev flow
- browse listings
- listing detail
- create listing with JPEG/PNG/WEBP upload
- reject SVG/HTML/oversized image upload
- my listings edit/status/upload/delete image controls
- favorite/unfavorite without exposing actor identity
- favoriteCount changes after favorite/unfavorite
- notification unread/read/read-all behavior
- message seller
- idempotent start conversation
- send normal message
- reject unsafe message body
- unread count drops only after conversation content is viewed
- mobile width check for listing upload and messaging

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

## Known Risks

- Local image files are not durable production storage.
- Realtime is not yet scaled with a Redis adapter.
- Email delivery is still no-op/dev.
- Web flows depend on manual QA until E2E tests exist.
- AI is mock-only except for audit logging structure.
- Admin moderation is foundation-level: report/block intake, redacted backoffice list/detail, and permissioned sensitive access exist; full reviewer workflow and admin dashboards remain incomplete.


<!-- 2026-06-11-backoffice-privacy-redaction-foundation -->
## 2026-06-11 Update — Backoffice Data Privacy + Redaction Foundation

### Current active backlog item

```txt
Permissioned Sensitive Raw Data Access + Audit
```

### Why this is active now

Backoffice moderation list/detail flow now works with real case IDs.

Before adding more trust & safety, support, or AI tooling, the API response contract must stop exposing unnecessary sensitive data.

### Done before this item

- Backoffice app created.
- Backoffice port set to `3001`.
- Backoffice shell/auth basic flow added.
- Admin/non-admin access behavior added.
- Moderation list route added.
- Moderation detail route added.
- Dynamic case route moved to correct app router location.
- Detail screen opens with real case ID.
- Basic status/action forms exist.

### Previously completed privacy work

- API redaction utility.
- Server-side safe message preview.
- Reporter identity redaction.
- Query-level reporter minimization.
- Backoffice raw DTO update.
- PII regression tests.
- Redaction utility unit tests.
- Docs update.

### Implemented in this item

```txt
Permissioned Sensitive Raw Data Access + Audit
```

- Separate `POST /api/v1/admin/moderation/cases/:caseId/sensitive-access` endpoint.
- Explicit reason and allowlisted fields required.
- Dedicated sensitive-access gate helper.
- Successful raw access audited through the `events` table.
- Denied sensitive-access attempts are audited when actor and case context are safely available.
- Backoffice client function added without automatic reveal on page load.
- Backoffice case detail now has an explicit sensitive-access request panel with warning, reason, field selection, audit id display, and clear-from-state action.
- Backoffice moderation list now has safe triage filters for status, target type, search, sort, and limit.
- Moderation list summary cards/counts are based on the current redacted result set and do not expose raw sensitive data.
- Backoffice case detail now has a safe combined timeline for case/report context, moderation actions, status changes, and sensitive-access granted/denied audit events.
- Timeline audit metadata is allowlisted server-side and does not expose raw message bodies, reporter emails, tokens, full profile/listing/conversation data, or conversation participants.

### Later backlog

1. Granular sensitive-data permission model beyond the current admin compatibility gate.
2. Admin actor minimization in timeline response.
3. AI moderation summary endpoint using redacted inputs by default.
4. AI recommendation UI in backoffice.
5. Deeper moderation queue pagination, assignment, SLA tracking, and dashboard workflows.
6. Listing/profile/message action workflows.
7. Full trust & safety audit event dashboard.
8. Granular denied-audit policy for unauthenticated and malformed requests.
