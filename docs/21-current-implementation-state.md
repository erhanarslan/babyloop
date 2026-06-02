# BabyLoop Current Implementation State

## Purpose

This document records the actual implemented state of BabyLoop after the initial marketplace, auth, mock AI, favorites, messaging API, messaging web UI, and API test work.

This is not a wishlist. It describes what exists now, what is partially implemented, and what is not production-ready yet.

## Project Status

BabyLoop is currently a local full-stack marketplace foundation.

Implemented stack:

- pnpm workspace monorepo
- Turborepo
- TypeScript
- Next.js web app
- Fastify API
- PostgreSQL
- Drizzle ORM schema and migrations
- local seed data
- auth foundation
- listings
- favorites
- mock AI listing suggestions
- AI model run audit table
- messaging API foundation
- messaging web UI foundation
- API integration test foundation with Vitest

Current maturity level:

```text
Local MVP foundation
```

## Implemented Web Routes

- `/`
- `/browse`
- `/listings/[id]`
- `/sell`
- `/login`
- `/register`
- `/favorites`
- `/my-listings`
- `/conversations`
- `/conversations/[id]`

## Current Implemented Features

Implemented:

| Area | Current state |
| --- | --- |
| Auth | Email/password register/login, `GET /api/v1/auth/me`, signed access tokens, basic register/login rate limiting. |
| Listings | Public active listing list/detail, authenticated listing creation, authenticated current-user listing list, web browse/detail/sell/my-listings pages. |
| Listing image metadata | Optional image URLs can be stored and rendered. Real upload/storage is not implemented. |
| Favorites | Authenticated favorite/unfavorite/list API and web UI. |
| Messaging | Authenticated API routes, web conversations list, web conversation thread page, and plain text send UI. |
| Mock AI | Deterministic listing suggestion provider, API route, sell-page integration, and `ai_model_runs` logging when DB is configured. |
| Tests | API integration tests exist under `apps/api/test` and use Vitest with `fastify.inject`. |

Partially implemented:

| Area | Current limitation |
| --- | --- |
| Auth/session | Access-token auth exists, but localStorage token storage is local-MVP level. No refresh/session table or HTTP-only cookie transport yet. |
| Listing discovery | Public browse/detail exists, but search/filter/pagination are limited or missing. |
| Messaging | List/thread/send works, but no realtime, unread counts, report/block, attachments, notifications, or AI moderation yet. |
| AI | Mock listing suggestion exists. No real LLM provider, price recommendation, RAG, moderation, or recommendation engine yet. |

Not implemented:

- Google OAuth
- password reset
- email verification
- real image upload/storage
- listing edit/archive/delete lifecycle as user-facing API/UI
- admin panel
- mobile app
- payments
- realtime messaging
- production observability/deployment pipeline

Intentionally deferred:

- real AI providers, pricing, RAG, recommendations, and AI moderation
- admin, worker, and mobile apps
- notifications and automation workflows
- production-grade auth/session hardening

## Implemented API Areas

- `GET /health`
- auth register/login/me
- public categories/listings reads
- protected listing creation
- protected current-user listing list via `GET /api/v1/me/listings`
- protected favorites add/remove/list
- mock AI listing suggestions
- authenticated messaging endpoints

Current listing/favorite API behavior:

- public listing list/detail endpoints return active listings only
- listing creation derives the seller profile from the authenticated token
- current-user listing list returns only listings owned by the authenticated profile, including non-public statuses
- favorite writes derive the profile from the authenticated token
- users cannot favorite their own listings or inactive listings
- duplicate favorite creation and missing favorite removal are idempotent

## Messaging State

The implemented messaging model is profile-pair based:

- `conversations` stores one channel per normalized profile pair.
- `conversation_listing_contexts` attaches one or more listings to that channel.
- `conversation_participants` supports access checks and future flexibility.
- `messages` stores plain text messages.

The old listing-based conversation model is deprecated and should not be restored.

Implemented messaging UI:

- listing detail can start or reuse a conversation with the seller for logged-in non-sellers.
- `/conversations` lists the authenticated user's conversations.
- `/conversations/[id]` shows a thread and message composer.
- sending plain text messages from the web UI is implemented.

Messaging not implemented yet:

- realtime delivery
- unread counts
- report/block flows
- attachments
- notifications
- AI moderation

## Not Production-Ready Yet

- no realtime delivery
- no message moderation
- basic register/login rate limiting exists
- auth token storage is local-MVP level (`localStorage`); production session transport is not complete
- no web or end-to-end browser test suite yet
- no admin/mobile/worker apps yet

## Productization Blockers

- production-grade auth/session transport
- Google OAuth
- listing edit/archive/delete lifecycle
- image upload/storage and validation
- search/filter/pagination
- messaging unread/realtime/report/block flows
- admin/moderation tools
- trust and safety workflows
- CI/deployment/observability

## Validation Commands

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
