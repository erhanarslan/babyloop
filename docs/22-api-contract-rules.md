# BabyLoop API Contract Rules

## Purpose

This document defines naming and contract rules for BabyLoop.

The goal is to prevent mixing database naming conventions with public API and frontend conventions.

## Core Decision

BabyLoop uses different naming conventions per layer.

| Layer | Convention |
| --- | --- |
| PostgreSQL table names | `snake_case` |
| PostgreSQL column names | `snake_case` |
| Drizzle TypeScript properties | `camelCase` |
| API request body keys | `camelCase` |
| API response body keys | `camelCase` |
| Frontend variables/types/props/state | `camelCase` |
| Error codes | `UPPER_SNAKE_CASE` |
| Environment variables | `UPPER_SNAKE_CASE` |
| Domain enum values | may remain `snake_case` |

## Database Naming

PostgreSQL table and column names must use `snake_case`.

Examples:

```sql
product_categories
listing_images
conversation_participants
conversation_listing_contexts
ai_model_runs
profile_low_id
profile_high_id
created_by_profile_id
```

## Public API Naming

Public request and response bodies must use `camelCase`.

Examples:

```json
{
  "listingId": "30000000-0000-4000-8000-000000000001"
}
```

```json
{
  "conversationId": "..."
}
```

Do not expose user-controlled `profile_id`, `profileId`, `sellerProfileId`, or `buyerProfileId` in protected write request bodies. The API derives profile ownership from the auth token.

## Messaging Contract

Messaging create requests use `listingId` as listing context input only.

`listingId` must not become the conversation uniqueness basis. The conversation itself is unique by normalized profile pair, and listing context is stored through `conversation_listing_contexts`.

## Listing And Favorite Rules

Public listing reads return active listings only:

- `GET /api/v1/listings`
- `GET /api/v1/listings/:id`

Authenticated seller listing reads are scoped to the current token profile:

- `GET /api/v1/me/listings`
- no request body or query profile id is accepted
- response may include owned listings with `active`, `draft`, or `archived` status

Favorite writes are token-owned and must follow these rules:

- request body uses `{ "listingId": "uuid" }`
- users cannot favorite their own listings
- users can only favorite active listings
- duplicate favorite creation remains idempotent
- removing a missing favorite remains idempotent
- `favorite_added` and `favorite_removed` events are written only when the database state actually changes

## Do Not Regress

- Do not reintroduce snake_case request bodies such as `listing_id`.
- Do not accept user-facing `sellerProfileId` or `profileId` in protected write bodies.
- Do not revert messaging to listing-based conversations.
- Do not create separate conversations per listing.
- Do not remove `conversation_listing_contexts`.
