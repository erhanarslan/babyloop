# System Architecture

## Recommended Monorepo Structure

The repository should later use pnpm workspaces and Turborepo. Do not initialize it until the first implementation phase is approved.

```text
babyloop/
  apps/
    web/
    admin/
    api/
    worker/
    mobile/        # later phase
  packages/
    shared/
    database/
    ai-core/
    pricing-engine/
    recommendation-engine/
    moderation-engine/
    notification-engine/
    config/
    ui/
  docs/
```

This is the target structure, not a requirement to create every app and package immediately. Phase 1 should create only the workspace/config files and directories needed for the next verified slice; future apps/packages can be added when a phase actually uses them.

## Current Foundation vs Final Scope

The initial foundation intentionally contains only:

- `apps/web`
- `apps/api`
- `packages/shared`
- `packages/config`

This does not remove the remaining target apps and packages from scope. `apps/admin`, `apps/mobile`, `apps/worker`, `packages/database`, `packages/ai-core`, `packages/pricing-engine`, `packages/recommendation-engine`, `packages/moderation-engine`, `packages/notification-engine`, and `packages/ui` are core parts of the final architecture. They are delayed so the base monorepo can be verified before more surfaces and ownership boundaries are introduced.

## Apps

| App | Responsibility |
| --- | --- |
| `apps/web` | Public marketplace, listing creation, search, messaging, parent profiles, user account. |
| `apps/admin` | Moderation, admin analytics, AI logs, prompt versions, operational tools. |
| `apps/api` | Core backend API, auth integration, marketplace services, AI task orchestration endpoints. |
| `apps/worker` | Background jobs for AI tasks, embeddings, notifications, reports, stale listing checks. |
| `apps/mobile` | Expo React Native app in a later phase after API contracts stabilize. |

## Packages

| Package | Responsibility |
| --- | --- |
| `packages/shared` | Shared TypeScript types, constants, API response contracts. |
| `packages/database` | Database schema, migrations, query helpers, seed data. |
| `packages/ai-core` | AI provider abstraction, prompt registry, task logging helpers. |
| `packages/pricing-engine` | Product valuation rules and comparable listing logic. |
| `packages/recommendation-engine` | Ranking inputs, scoring functions, recommendation explanations. |
| `packages/moderation-engine` | Policy categories, risk scoring helpers, moderation decision types. |
| `packages/notification-engine` | Notification templates, channels, routing rules. |
| `packages/config` | Shared env validation and app configuration. |
| `packages/ui` | Shared UI primitives after web/admin patterns stabilize. |

## Backend Services

The API should expose clear service boundaries:

- auth/profile service
- listing service
- media service
- search service
- messaging service
- transaction/swap service
- AI task service
- moderation service
- analytics/event service
- notification service
- admin service

Fastify is recommended for `apps/api` because it is lightweight, explicit, and portfolio-friendly for API architecture. NestJS remains a reasonable alternative if dependency injection and module conventions become more important than simplicity.

## Data Ownership

| Owner | Rule |
| --- | --- |
| `packages/database` | Owns schema definitions, migrations, seed data, and low-level database clients. |
| `apps/api` | Owns request validation, authorization, transactions, and user-facing writes. |
| `apps/worker` | Runs background jobs and writes job results through approved database/service helpers. |
| `apps/web` and `apps/admin` | Call API endpoints; they should not connect directly to the database. |
| AI/recommendation/moderation packages | Own scoring or task logic, not migrations or cross-feature writes. |
| Admin analytics assistant | Reads only from approved views or aggregate tables. |

## Worker Jobs and Queues

Use a queue system such as BullMQ later, backed by Redis. Before Redis is introduced, local phases can use explicit API calls, synchronous service calls, or a small manual job runner only when that keeps the current slice verifiable.

| Queue | Job examples |
| --- | --- |
| `ai` | Listing generation, valuation, condition analysis, RAG answer preparation. |
| `embedding` | Listing embeddings, knowledge base chunk embeddings. |
| `moderation` | Message/listing risk scoring, fraud checks, duplicate checks. |
| `notification` | Saved search alerts, price drops, stale listing reminders. |
| `analytics` | Daily aggregates, weekly category insights, admin reports. |

## Notification Layer

Initial channel:

- in-app notifications
- email

Later channels:

- push notifications
- WhatsApp
- Telegram
- Instagram-related sharing/workflow integrations

Notifications should be event-driven and preference-aware.

## Storage

| Storage | Use |
| --- | --- |
| PostgreSQL | Primary relational data and audit logs. |
| pgvector | Embeddings for RAG, listings, and similarity search. |
| Object storage | Product photos, generated thumbnails, moderation evidence. |
| Redis | Queue backend, rate limits, short-lived cache in later phases. |

## Database

PostgreSQL is the primary database. The design should emphasize:

- normalized marketplace entities
- append-only audit logs
- event tracking from the beginning
- AI task logs and prompt versions
- pgvector for RAG and similarity
- human review records for AI decisions

## External Integrations

Early:

- AI provider through OpenAI-compatible interface
- email provider
- object storage

Later:

- payment provider
- push notification provider
- WhatsApp/Telegram integrations
- image duplicate/copyright detection provider if needed
- observability services such as Sentry and OpenTelemetry

## High-Level Request Flows

### Listing Creation

1. Seller submits listing draft and images.
2. API validates input and stores draft.
3. Worker runs category prediction, listing generation, valuation, embedding, and moderation jobs.
4. Seller reviews AI suggestions and missing-info checklist.
5. Listing is published if validation and moderation pass.
6. AI task logs and analytics events are stored.

### Buyer Search

1. Buyer submits search/filter request.
2. API queries listings and ranking signals.
3. Events are logged for analytics and recommendation inputs.
4. Results are returned with saved-search eligibility.

### Message Moderation

1. User sends message.
2. API validates rate limits and sends content to moderation flow.
3. Safe messages are delivered.
4. Risky messages are warned, blocked, or queued.
5. Moderation decision and AI task result are logged.

### Admin AI Analytics

1. Admin asks a business question.
2. System maps the question to approved read-only metrics.
3. Query runs against analytics tables or safe database views.
4. Assistant returns answer with caveats and source metric names.
5. No write action is performed by the assistant.
