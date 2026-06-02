# Database Migration Safety Audit

## Scope

This audit reviews the current Drizzle schema and migration history for production-readiness risks.

Files inspected:

- `packages/database/src/schema/index.ts`
- `packages/database/drizzle/0000_salty_agent_zero.sql`
- `packages/database/drizzle/0001_wealthy_donald_blake.sql`
- `packages/database/drizzle/0002_good_songbird.sql`
- `packages/database/drizzle/0003_empty_jean_grey.sql`
- `packages/database/drizzle/0004_curly_longshot.sql`
- `packages/database/drizzle/meta/_journal.json`
- `packages/database/package.json`

Drizzle `db:check` currently passes, which means the checked schema and migration metadata are aligned. It does not prove that every migration is safe on a non-empty production database.

## Current Migration List

| Migration | High-level purpose | Risky operations |
| --- | --- | --- |
| `0000_salty_agent_zero.sql` | Initial marketplace schema: listing enums, profiles, categories, listings, images, favorites, events, indexes, and foreign keys. | Creates initial enums including `listing_type` with `rent`; initial creation is safe on an empty database. |
| `0001_wealthy_donald_blake.sql` | Adds AI audit log enum and `ai_model_runs`. | Initial table creation only; low migration risk. |
| `0002_good_songbird.sql` | Adds `users` and nullable `profiles.user_id` for auth. | Adds nullable column to existing `profiles`, then unique index and FK. Safe if any existing non-null `user_id` data is absent or unique, which it is for this migration path. |
| `0003_empty_jean_grey.sql` | Adds first messaging tables using the deprecated listing/buyer conversation model. | Creates required columns and constraints on new tables. Safe on empty/new messaging tables, but the model is now deprecated. |
| `0004_curly_longshot.sql` | Refactors messaging to canonical profile-pair conversations and adds `conversation_listing_contexts`. | Adds required `profile_low_id`, `profile_high_id`, and `created_by_profile_id` to existing `conversations` without default/backfill; drops old conversation columns; drops old indexes/FKs; creates new uniqueness/check constraints. High risk on non-empty databases. |

## Production Migration Risk Findings

### 1. Required columns added to existing tables

`0004_curly_longshot.sql` contains:

- `ALTER TABLE "conversations" ADD COLUMN "profile_low_id" uuid NOT NULL`
- `ALTER TABLE "conversations" ADD COLUMN "profile_high_id" uuid NOT NULL`
- `ALTER TABLE "conversations" ADD COLUMN "created_by_profile_id" uuid NOT NULL`

These statements fail if `conversations` already contains rows because PostgreSQL cannot populate the new required columns.

Recommended production strategy:

1. Add the new columns as nullable.
2. Backfill `profile_low_id`, `profile_high_id`, and `created_by_profile_id` from existing conversations, listing sellers, and buyer profiles.
3. Create `conversation_listing_contexts` rows from old `conversations.listing_id`.
4. Deduplicate old listing-based conversations into one profile-pair conversation where needed.
5. Repoint messages and participants to the canonical conversation.
6. Add `NOT NULL`, unique indexes, and checks only after validation.
7. Drop deprecated columns only after the backfill has been verified.

### 2. Enum changes

The initial `listing_type` enum includes `rent`.

Current product scope rejects rental listings at the API/UI layer, but the enum still contains `rent` for legacy/internal compatibility. Removing a PostgreSQL enum value requires a dedicated migration plan and should not be done casually.

No later migration alters enum values.

### 3. Dropped columns/tables

`0004_curly_longshot.sql` drops:

- `conversations.listing_id`
- `conversations.buyer_profile_id`

This is correct for the canonical profile-pair model, but unsafe for non-empty databases unless listing context has first been copied to `conversation_listing_contexts` and profile-pair fields have been backfilled.

No migration currently drops whole tables.

### 4. Constraint additions that may fail on existing data

Potential failure points:

- `conversations_profile_pair_unique` can fail if multiple old listing-based conversations map to the same profile pair.
- `conversations_profiles_not_same_check` can fail if a bad row maps both participants to the same profile.
- `conversation_listing_contexts_conversation_listing_unique` can fail if duplicate context rows are backfilled without deduplication.
- `messages_body_not_blank_check` and `messages_body_max_length_check` are safe in `0003` because `messages` is created fresh there. Future changes to message validation should account for existing rows.

### 5. Foreign key delete behavior

Current delete behavior appears intentional but should be reviewed before production:

| Area | Behavior | Risk note |
| --- | --- | --- |
| Listing images | Cascade when listing is deleted. | Fine for metadata cleanup; real storage deletion will need separate object cleanup. |
| Favorites | Cascade when profile or listing is deleted. | Fine for derived user state. |
| Events | `actor_profile_id` set null. | Good for retaining analytics while reducing profile dependency. |
| Listings | Restrict deleting seller profile/category. | Good for preserving marketplace data. |
| Conversations | Restrict deleting profile pair profiles and creator. | Good for preserving message ownership, but production deletion/privacy policy is still needed. |
| Messages | Cascade when conversation is deleted; restrict sender profile deletion. | Good for consistency; future account deletion/anonymization needs policy. |
| Conversation contexts | Cascade with conversation/listing, restrict added-by profile deletion. | Reasonable for MVP; privacy policy may require anonymization later. |

### 6. Missing or weak indexes for common queries

Existing indexes cover most ownership and access checks:

- listings by seller, category, and status
- favorites by profile/listing unique pair and listing
- conversations by profile pair columns and last message time
- messages by conversation and conversation/created_at
- conversation listing contexts by conversation/listing
- users by email

Potential improvements before beta:

- `listings(status, created_at)` for public active listing feeds sorted by recency.
- `listings(category_id, status)` if category filtering becomes common.
- `conversations(profile_low_id, last_message_at)` and `conversations(profile_high_id, last_message_at)` if conversation inbox sorting becomes slow at scale.
- `ai_model_runs(feature, created_at)` for audit/admin filtering.

Do not add these prematurely; add them when query plans or feature load justify them.

### 7. Data backfill needs

Known backfill-sensitive areas:

- Messaging migration from deprecated listing/buyer conversations to profile-pair conversations.
- Future removal of `rent` from `listing_type`.
- Future real image upload migration from manual URL metadata to managed storage metadata.
- Future production auth/session migration if moving from access-token-only auth to sessions/refresh tokens/cookies.

## Specific Conversations Migration Note

The current canonical schema is correct for the intended messaging model:

- one conversation per normalized profile pair
- listing context stored in `conversation_listing_contexts`
- messages belong to conversations
- participants remain for access checks/flexibility

However, the migration history reaches that schema through `0003` and `0004`.

`0004_curly_longshot.sql` is safe for an empty/local database, but it is not backfill-safe for a production database that already has rows in `conversations`, `conversation_participants`, or `messages`.

Before production, replace or supersede this with a carefully staged migration if any shared/staging database has already applied `0003` with data.

See `docs/27-messaging-migration-backfill-plan.md` for the decision gate and staged backfill strategy.

## Safe Migration Rules for BabyLoop

- Never add a `NOT NULL` column to a non-empty table without a default or explicit backfill.
- Never remove a PostgreSQL enum value casually.
- Never edit an applied migration.
- Prefer additive migrations.
- Write data backfill migrations explicitly.
- Make destructive cleanup the final step, after verification.
- Name constraints and indexes explicitly.
- Run `pnpm --filter @babyloop/database db:check` before merge.
- Test migrations on staging-like data before production.
- Review foreign key delete behavior before enabling user deletion, listing deletion, or privacy workflows.

## Recommendations

### Must Do Before Production

- Create a production-safe messaging migration/backfill plan for any database that may contain old listing-based conversation rows.
- Confirm whether `0004_curly_longshot.sql` has been applied to any shared database with data.
- Add a migration rehearsal step using a staging-like database dump.
- Keep `rent` in the database enum until a dedicated safe enum migration exists.
- Define retention/anonymization policy for messages, events, AI logs, and profiles.

### Should Do Before Beta

- Add query-plan review for public listing feed and conversation inbox.
- Consider composite indexes for listing feed and inbox queries if needed.
- Document a rollback strategy for each future migration.
- Add CI gating for `db:check`, typecheck, build, and API tests.

### Can Defer

- Enum removal for `rent`.
- Advanced analytics aggregate tables.
- pgvector/RAG tables.
- Payment/order/rental tables.
- Storage-object cleanup automation for real image uploads.

## Validation Run

Last verified during this audit:

```bash
pnpm --filter @babyloop/database db:check
pnpm --filter @babyloop/database typecheck
```

Both commands passed.
