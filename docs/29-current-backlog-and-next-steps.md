# Current Backlog and Next Steps

## Purpose

This document keeps the BabyLoop backlog aligned with the actual codebase so future work starts from true project state.

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
- deterministic message moderation
- mock AI listing suggestions
- AI audit logging

## Partially Complete

- production auth/session hardening
- real email delivery
- Google OAuth production validation
- MFA user-facing management
- listing discovery/filtering
- image handling beyond local storage
- moderation/report/block workflow
- realtime production scaling
- AI production/provider/RAG features
- UI system
- web tests/E2E

## Production Blockers

- production-safe auth/session transport and device/session UI
- real email provider
- verified Google OAuth deployment config
- R2/S3-compatible image storage and image moderation
- report user/listing/message
- block user
- moderation queue/admin review
- search filters/pagination
- web E2E tests
- observability and production deployment hardening

## Next P0 Tasks

- Add report/block workflow for listings, messages, and users.
- Add admin/moderation queue foundation.
- Move image storage from local disk to an S3/R2-compatible provider without changing public API contracts.
- Add image moderation and safer image processing/metadata handling.
- Add production email delivery.
- Add web E2E tests for auth, listing create/upload, favorites, notifications, and messaging.

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
- Admin moderation and reporting are not implemented.
