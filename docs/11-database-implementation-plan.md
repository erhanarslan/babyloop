# Database Implementation Plan

## 1. Database Technology Decision

| Technology | Decision | Reason |
| --- | --- | --- |
| PostgreSQL | Use from the first database slice. | BabyLoop needs relational integrity for profiles, categories, listings, favorites, and event tracking. PostgreSQL is reliable, widely used, and portfolio-relevant. |
| Drizzle ORM | Recommended for the first implementation. | Drizzle keeps schema close to TypeScript, supports small migrations, and avoids a heavy framework layer at this stage. |
| pgvector | Add later. | Vector search is needed for RAG, recommendations, and similar listing search, but the first slice does not yet implement AI or embeddings. |
| Redis | Add later. | Redis will be useful for queues, rate limits, and cache, but the first slice does not need background jobs. |

Do not add all AI tables immediately. AI logs, prompt versions, RAG chunks, condition analysis, and recommendation outputs should be introduced when their implementation phase starts. Adding them now would increase migration complexity before the app has real AI workflows to validate the table shapes.

## 2. First Database Slice

The first database slice should support only the minimum marketplace foundation needed before real product features expand.

| Table | Purpose | Notes |
| --- | --- | --- |
| `profiles` | Stores basic user-facing profile data. | Use a simple profile id now. Auth/user identity can be connected later without redesigning listing ownership. |
| `product_categories` | Stores category tree and safety-sensitive flags. | Needed before listings so products can be categorized consistently. |
| `listings` | Stores basic listing records. | Include seller/profile reference, category reference, title, description, status, condition, price, city/region, and timestamps. |
| `listing_images` | Stores uploaded image metadata only. | Store URL/path, alt text, sort order, and listing reference. Do not process images or run condition analysis yet. |
| `favorites` | Stores saved listings for users/profiles. | Enables a small buyer interaction without implementing search, recommendations, or notifications. |
| `events` | Stores basic append-only analytics events. | Track simple events such as listing view, listing created, favorite added. Avoid raw private data in properties. |

Recommended first-slice relationships:

- `profiles` has many `listings`
- `product_categories` has many `listings`
- `product_categories` can reference a parent category
- `listings` has many `listing_images`
- `profiles` has many `favorites`
- `listings` has many `favorites`
- `events` can reference a profile and optionally an entity through `entity_type` and `entity_id`

Keep enums/statuses small:

- listing status: `draft`, `active`, `archived`
- listing condition: `new`, `like_new`, `good`, `fair`, `needs_repair`
- event type: store as text initially, but validate in application code

## 3. Tables Intentionally Delayed

| Delayed area | Why delayed |
| --- | --- |
| AI logs and prompt versions | Add when AI task execution begins so fields match real provider, prompt, schema, and audit needs. |
| RAG chunks and embeddings | Requires knowledge base ingestion, chunking, embeddings, and pgvector. Not needed for first schema slice. |
| Message moderation | Depends on messaging and moderation workflow phases. |
| Swap engine | Depends on valuation, messaging, and trade-offer workflows. |
| Payments and rentals | Larger compliance and state-management surface; not needed before listings work. |
| Notification logs | Add when notification channels and user preferences exist. |
| Analytics aggregates | Raw `events` should come first; aggregate tables should be derived after dashboard queries are known. |

## 4. Migration Strategy

Use small migrations and keep each migration easy to review.

| Practice | Plan |
| --- | --- |
| Migration size | One focused migration for the first slice tables. Future migrations should map to a specific feature slice. |
| Rollback awareness | Prefer additive changes early. If rollback files are not automatic, document how to reverse each migration safely. |
| Seed data | Add seed data only for categories, sample profiles, and sample listings needed for local verification. |
| Local dev database | Use a local PostgreSQL database. Keep setup documented and reproducible. |
| Environment variables | Start with `DATABASE_URL`. Keep `.env.example` updated when implementation begins. |
| Schema ownership | Put schema and migrations in `packages/database` when that package is introduced. API code should not own migrations. |
| Data safety | Avoid storing unnecessary personal data. Event properties should use safe metadata and references. |

Recommended future package introduction:

```text
packages/database/
  src/
    schema/
    client.ts
    index.ts
  drizzle/
  drizzle.config.ts
```

This package should be added only when the database implementation step begins.

## 5. Verification Checklist

When database implementation starts, verify in this order:

1. Install DB dependencies.
2. Add `DATABASE_URL` to `.env.example`.
3. Create the initial schema.
4. Generate the first migration.
5. Run the migration against the local dev database.
6. Seed sample product categories, profiles, listings, listing images, favorites, and events.
7. Query one sample listing with its category, seller profile, image metadata, and favorite count.
8. Run API/package typecheck.
9. Confirm no AI, auth, payment, queue, or external service code was added.

## 6. Suggested Technology

Use Drizzle ORM unless a strong blocker appears.

Recommended starting dependencies for the future implementation step:

- `drizzle-orm`
- `drizzle-kit`
- `pg`
- `@types/pg`

Do not install them during this planning step. Install only when the database implementation phase is approved.
