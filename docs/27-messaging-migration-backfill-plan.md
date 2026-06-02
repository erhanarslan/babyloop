# Messaging Migration Backfill Plan

## 1. Executive Summary

BabyLoop's current messaging schema direction is correct for the product:

- one conversation per normalized profile pair
- listing references stored separately as conversation context
- messages stored under the profile-pair conversation
- participant rows used for access checks and future flexibility

The production risk is not the final schema. The risk is the existing migration path from `0003_empty_jean_grey.sql` to `0004_curly_longshot.sql`.

`0004_curly_longshot.sql` adds required fields to the existing `conversations` table:

- `profile_low_id`
- `profile_high_id`
- `created_by_profile_id`

Those fields are `NOT NULL` and are added without a backfill. On a non-empty database, PostgreSQL can fail immediately because existing rows have no values for those columns.

The same migration drops legacy fields:

- `listing_id`
- `buyer_profile_id`

Dropping these before backfilling `conversation_listing_contexts`, profile-pair fields, and participants can lose the information needed to reconstruct the new model.

Recommended approach before production:

- If there is no real/shared/staging data, do a pre-production baseline cleanup before any public usage.
- If any shared/staging/production data exists, use a forward-only staged migration with explicit backfill and validation.
- Do not edit applied migrations.
- Do not claim the current `0004` path is production-safe for non-empty databases.

## 2. Current Conversation Model

Based on `packages/database/src/schema/index.ts` and `apps/api/src/services/messaging.service.ts`, the current model is:

### `conversations`

Current fields include:

- `id`
- `profile_low_id`
- `profile_high_id`
- `created_by_profile_id`
- `status`
- `last_message_at`
- `created_at`
- `updated_at`

Important rules:

- `profile_low_id` and `profile_high_id` are normalized lexicographically by profile id.
- `conversations_profile_pair_unique` enforces one conversation per profile pair.
- `conversations_profiles_not_same_check` prevents a profile from conversing with itself.
- `created_by_profile_id` records who initiated the conversation.
- `last_message_at` is updated when a message is sent.

### `conversation_participants`

Current fields include:

- `id`
- `conversation_id`
- `profile_id`
- `created_at`

Important rules:

- unique pair: `conversation_id + profile_id`
- used by the API for participant-only access checks
- remains useful even though profile-pair uniqueness is enforced on `conversations`

### `conversation_listing_contexts`

Current fields include:

- `id`
- `conversation_id`
- `listing_id`
- `added_by_profile_id`
- `created_at`

Important rules:

- unique pair: `conversation_id + listing_id`
- stores listing-specific context without creating separate conversations per listing
- API creates or reuses the profile-pair conversation, then inserts listing context with `onConflictDoNothing`

### `messages`

Current fields include:

- `id`
- `conversation_id`
- `sender_profile_id`
- `body`
- `created_at`
- `deleted_at`

Important rules:

- messages belong to conversations
- `sender_profile_id` is restricted by profile foreign key
- body must be non-blank and no longer than 5000 characters
- sending a message updates `conversations.last_message_at` and `conversations.updated_at`

## 3. Old Model vs New Model

### Old model from `0003_empty_jean_grey.sql`

`conversations` directly stored:

- `listing_id`
- `buyer_profile_id`

Uniqueness was:

- `conversations_listing_buyer_unique` on `listing_id + buyer_profile_id`

This meant a buyer and seller could have separate conversations for separate listings.

### New model from current schema

`conversations` stores:

- `profile_low_id`
- `profile_high_id`
- `created_by_profile_id`
- `status`
- `last_message_at`

Listing context moved to:

- `conversation_listing_contexts.conversation_id`
- `conversation_listing_contexts.listing_id`
- `conversation_listing_contexts.added_by_profile_id`

Uniqueness is now:

- `conversations_profile_pair_unique` on `profile_low_id + profile_high_id`

This means the same two profiles share exactly one conversation channel, even if they discuss multiple listings.

## 4. Risk Analysis for `0004_curly_longshot.sql`

### NOT NULL columns added without backfill

`0004_curly_longshot.sql` runs:

```sql
ALTER TABLE "conversations" ADD COLUMN "profile_low_id" uuid NOT NULL;
ALTER TABLE "conversations" ADD COLUMN "profile_high_id" uuid NOT NULL;
ALTER TABLE "conversations" ADD COLUMN "created_by_profile_id" uuid NOT NULL;
```

This fails on non-empty `conversations` because existing rows cannot satisfy the new required columns.

### Dropping `listing_id` and `buyer_profile_id`

The migration later runs:

```sql
ALTER TABLE "conversations" DROP COLUMN "listing_id";
ALTER TABLE "conversations" DROP COLUMN "buyer_profile_id";
```

These fields are needed to derive:

- buyer profile
- seller profile through `listings.seller_profile_id`
- normalized profile pair
- listing context rows

Dropping them before backfill risks losing migration source data.

### `conversation_listing_contexts` backfill need

Every old conversation with `listing_id` should produce a context row:

- `conversation_id`
- `listing_id`
- `added_by_profile_id`

`added_by_profile_id` should usually be the old `buyer_profile_id`, because the old model represented buyer-started listing conversations. If historical data proves sellers could start old conversations, use the actual initiator if available.

### Participant reconstruction need

Old `conversation_participants` may already contain participants, but a safe migration must verify and repair:

- old buyer profile exists as participant
- listing seller profile exists as participant
- no duplicate participant rows
- no participants pointing to removed/merged conversations after deduplication

### `profile_low_id` / `profile_high_id` derivation

For each old conversation:

```text
buyer_profile_id = conversations.buyer_profile_id
seller_profile_id = listings.seller_profile_id
profile_low_id = least(buyer_profile_id, seller_profile_id)
profile_high_id = greatest(buyer_profile_id, seller_profile_id)
```

Self-conversations must be rejected or quarantined before adding `conversations_profiles_not_same_check`.

### `created_by_profile_id` derivation

Preferred derivation:

1. Use explicit old creator field if one exists. In the inspected old schema, it does not.
2. Use old `buyer_profile_id` as a conservative default.
3. If a conversation has messages and the first sender is known, consider using first message sender only if product history confirms that represents the creator.

For BabyLoop's old model, `buyer_profile_id` is the safest deterministic default.

### Duplicate conversation risk

The old unique key allowed multiple conversations for the same buyer/seller pair when each conversation referenced a different listing.

Example:

| Old conversation | listing | buyer | seller |
| --- | --- | --- | --- |
| C1 | stroller | Ayse | Mehmet |
| C2 | car seat | Ayse | Mehmet |

The new model allows only one Ayse/Mehmet conversation. A migration must merge or otherwise handle duplicates before adding:

```sql
CREATE UNIQUE INDEX "conversations_profile_pair_unique"
ON "conversations" ("profile_low_id", "profile_high_id");
```

### Multiple listing conversations between same buyer/seller

Product rule says there should be one conversation per two profiles. Therefore duplicate old conversations for the same pair should generally be merged into one canonical conversation:

- choose one canonical conversation id per profile pair
- move messages to canonical conversation, preserving `created_at`
- move participants to canonical conversation
- create listing context rows for every old listing
- update `last_message_at` from max message timestamp
- archive/delete duplicate rows only after verification

If preserving old conversation ids is required for external links, add a temporary mapping table during migration planning.

## 5. Safe Migration Strategy Options

### Option A: Pre-production Baseline Reset

Only acceptable if there is no real/staging/production user data.

Approach:

- Confirm no shared database contains real conversations/messages.
- Reset local/dev databases only.
- Generate or keep a clean baseline that represents the final profile-pair schema.
- Re-run migrations from scratch on empty databases.
- Seed local data again.

Pros:

- simplest path before public usage
- no complicated merge/backfill logic
- reduces long-term migration history complexity

Cons:

- destroys data
- cannot be used after real users, staging QA data, or shared product demos matter
- does not validate the forward-only production migration path

Warning: never use this on real user data.

### Option B: Forward-only Safe Migration With Staged Backfill

Required if any shared/staging/production database has conversation data.

Recommended sequence:

1. Create a backup.
2. Run a dry-run on a staging-like copy.
3. Add new columns as nullable:
   - `profile_low_id`
   - `profile_high_id`
   - `created_by_profile_id`
   - `status` with default if needed
   - `last_message_at`
4. Create `conversation_listing_contexts` if it does not exist.
5. Backfill profile pairs from old data:
   - join `conversations.listing_id` to `listings.id`
   - use `listings.seller_profile_id`
   - use `conversations.buyer_profile_id`
   - compute low/high ordering
6. Backfill `created_by_profile_id`:
   - use old `buyer_profile_id` unless a better audited source exists
7. Backfill `conversation_listing_contexts`:
   - one row per old conversation/listing
   - `added_by_profile_id = buyer_profile_id` unless proven otherwise
8. Repair participants:
   - insert buyer participant
   - insert seller participant
   - dedupe via unique constraint
9. Detect duplicate profile-pair conversations.
10. Merge duplicates according to product rule:
   - choose canonical row per pair
   - move messages to canonical conversation
   - move participants to canonical conversation
   - move/create listing contexts on canonical conversation
   - recompute `last_message_at`
   - remove duplicate conversation rows only after verification
11. Validate no null profile fields remain.
12. Validate low/high ordering and no self-pairs.
13. Add `NOT NULL` constraints.
14. Add unique constraints/indexes.
15. Add foreign keys/check constraints.
16. Keep old columns for one migration release if possible.
17. Drop old `listing_id` and `buyer_profile_id` only after verification.

This option should be implemented as new forward migration files. Do not edit already-applied migrations.

### Option C: Compatibility Transition

Useful when zero-downtime or low-risk gradual rollout matters.

Approach:

- Keep old columns temporarily.
- Add new nullable columns and context table.
- Backfill data in batches.
- Change API writes to new model only.
- Make reads support both models during a transition window.
- Validate all old rows have migrated.
- Remove old read fallback in a later release.
- Drop old columns in a final cleanup migration.

Pros:

- safest rollout for active systems
- easier rollback during transition
- allows observability before destructive cleanup

Cons:

- more code complexity during the transition
- requires strict discipline to remove compatibility code later
- not needed if BabyLoop has no real data yet

## 6. Recommended Choice for BabyLoop Now

Decision gate:

- If this repo has no real/shared/staging user data, use Option A: pre-production baseline cleanup before staging/prod.
- If any shared/staging/production data exists, use Option B: forward-only staged migration.
- If the app is already live or near-live while old and new API versions might overlap, use Option C.

Do not assume which is true.

For the current portfolio/local MVP state, BabyLoop likely can choose Option A only if the owner confirms there is no valuable shared data. If that cannot be confirmed, default to Option B.

Conservative recommendation:

1. Ask/verify whether any non-local database has applied `0003` or `0004`.
2. If no, clean up before public/staging usage.
3. If yes, design a forward-only backfill migration and rehearse it on a database copy.

## 7. Data Validation Queries and Checks

These are SQL-like checks for staging/dry-run validation. Adjust names if running before or after specific migration phases.

### Conversations missing profile pair fields

```sql
SELECT id
FROM conversations
WHERE profile_low_id IS NULL
   OR profile_high_id IS NULL;
```

### Conversations missing creator

```sql
SELECT id
FROM conversations
WHERE created_by_profile_id IS NULL;
```

### Conversations without participants

```sql
SELECT c.id
FROM conversations c
LEFT JOIN conversation_participants cp
  ON cp.conversation_id = c.id
GROUP BY c.id
HAVING COUNT(cp.id) = 0;
```

### Conversations missing one of the profile-pair participants

```sql
SELECT c.id
FROM conversations c
WHERE NOT EXISTS (
  SELECT 1
  FROM conversation_participants cp
  WHERE cp.conversation_id = c.id
    AND cp.profile_id = c.profile_low_id
)
OR NOT EXISTS (
  SELECT 1
  FROM conversation_participants cp
  WHERE cp.conversation_id = c.id
    AND cp.profile_id = c.profile_high_id
);
```

### Conversations without listing context when old `listing_id` existed

Run before dropping old columns:

```sql
SELECT c.id, c.listing_id
FROM conversations c
LEFT JOIN conversation_listing_contexts clc
  ON clc.conversation_id = c.id
 AND clc.listing_id = c.listing_id
WHERE c.listing_id IS NOT NULL
  AND clc.id IS NULL;
```

### Duplicate profile-pair conversations

```sql
SELECT profile_low_id, profile_high_id, COUNT(*) AS conversation_count
FROM conversations
GROUP BY profile_low_id, profile_high_id
HAVING COUNT(*) > 1;
```

### Orphaned messages

```sql
SELECT m.id
FROM messages m
LEFT JOIN conversations c ON c.id = m.conversation_id
WHERE c.id IS NULL;
```

### Orphaned conversation listing contexts

```sql
SELECT clc.id
FROM conversation_listing_contexts clc
LEFT JOIN conversations c ON c.id = clc.conversation_id
LEFT JOIN listings l ON l.id = clc.listing_id
WHERE c.id IS NULL
   OR l.id IS NULL;
```

### Invalid low/high ordering

```sql
SELECT id, profile_low_id, profile_high_id
FROM conversations
WHERE profile_low_id >= profile_high_id;
```

### Self-conversations

```sql
SELECT id
FROM conversations
WHERE profile_low_id = profile_high_id;
```

### `last_message_at` consistency

```sql
SELECT c.id, c.last_message_at, MAX(m.created_at) AS actual_last_message_at
FROM conversations c
LEFT JOIN messages m ON m.conversation_id = c.id
GROUP BY c.id, c.last_message_at
HAVING (
  MAX(m.created_at) IS NULL AND c.last_message_at IS NOT NULL
)
OR (
  MAX(m.created_at) IS NOT NULL AND c.last_message_at IS DISTINCT FROM MAX(m.created_at)
);
```

### Participants outside the profile pair

This may be allowed in future group/support flows, but should be reviewed for the current two-profile model:

```sql
SELECT cp.conversation_id, cp.profile_id
FROM conversation_participants cp
JOIN conversations c ON c.id = cp.conversation_id
WHERE cp.profile_id NOT IN (c.profile_low_id, c.profile_high_id);
```

## 8. Rollback and Contingency Notes

- Take a full backup before migration.
- Run the migration on a staging-like database copy first.
- Do not edit applied migrations.
- Prefer new forward migration files.
- Make backfill scripts idempotent where possible.
- Use explicit transaction boundaries.
- Avoid one huge transaction if the table is large and locks would be dangerous.
- Keep old columns until validation passes.
- Keep a mapping of duplicate old conversation ids to canonical ids during merge.
- Log row counts before and after each backfill stage.
- Stop before destructive cleanup if any validation query returns unexpected rows.
- Define rollback per stage:
  - before dropping old columns, rollback can usually ignore new nullable columns
  - after moving messages/participants, rollback requires the mapping table or backup
  - after dropping old columns, rollback requires backup restore or a reverse migration with preserved mapping data

## 9. Test Plan

### Migration dry-run test plan

1. Create a staging-like database copy.
2. Insert representative old-model data:
   - one buyer/seller/listing conversation
   - multiple listing conversations for the same buyer/seller
   - messages in duplicate conversations
   - missing participant rows
   - blank or invalid data only if it may exist historically
3. Run the staged migration.
4. Run all validation queries.
5. Confirm duplicate old conversations were merged or handled according to the product rule.
6. Confirm messages preserve order and sender ids.
7. Confirm listing contexts exist for all old listings.
8. Confirm `last_message_at` matches latest message timestamps.

### API regression tests after migration

Run:

```bash
pnpm preflight
pnpm --filter @babyloop/api test
pnpm typecheck
pnpm build
```

API behaviors to verify:

- create conversation requires auth
- seller cannot message own listing
- repeated create for the same profile pair returns the same conversation
- listing context is created/reused
- only participants can list/read conversations
- participants can send messages
- non-participants are blocked
- blank messages are rejected
- `lastMessageAt` updates after send
- latest message does not leak to outsiders

### Manual QA after migration

Use seeded or staging users:

1. Buyer starts a conversation from a listing.
2. Buyer sends a message.
3. Seller sees the conversation in inbox.
4. Seller replies.
5. Buyer sees the reply.
6. Buyer opens a second listing from the same seller.
7. Starting message flow reuses the same conversation and adds listing context.
8. Unauthorized user cannot open the thread.

### Data integrity checks after migration

Run the validation queries from section 7 after migration and before cleanup. Archive the results in the release notes or deployment checklist.

## 10. Follow-up Implementation Prompts

### Prompt for pre-production baseline cleanup

```text
BabyLoop has no real/shared/staging user data. Create a pre-production database baseline cleanup plan for messaging migrations. Do not edit migrations yet. Identify how to safely reset local/dev databases, regenerate a clean baseline if appropriate, preserve seed/dev workflow, and verify Drizzle db:check/typecheck/build/test.
```

### Prompt for forward-only staged migration design

```text
BabyLoop has shared/staging/production data that may include old listing-based conversations. Design a forward-only Drizzle/PostgreSQL staged migration for messaging backfill. Do not edit migrations yet. Include nullable column phase, backfill SQL, duplicate profile-pair merge strategy, validation queries, rollback notes, and test plan.
```
