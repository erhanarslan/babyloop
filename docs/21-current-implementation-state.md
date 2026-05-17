# BabyLoop Current Implementation State

## Purpose

This document records the actual implemented state of BabyLoop after the initial marketplace, auth, mock AI, favorites, and messaging backend work.

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
- messaging backend foundation

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

Messaging web UI is not implemented yet.

## Implemented API Areas

- `GET /health`
- auth register/login/me
- public categories/listings reads
- protected listing creation
- protected favorites add/remove/list
- mock AI listing suggestions
- authenticated messaging backend endpoints

## Messaging State

The implemented messaging model is profile-pair based:

- `conversations` stores one channel per normalized profile pair.
- `conversation_listing_contexts` attaches one or more listings to that channel.
- `conversation_participants` supports access checks and future flexibility.
- `messages` stores plain text messages.

The old listing-based conversation model is deprecated and should not be restored.

## Not Production-Ready Yet

- no web messaging UI
- no realtime delivery
- no message moderation
- no rate limiting
- auth token storage is local-MVP level
- no automated test suite
- no admin/mobile/worker apps yet
