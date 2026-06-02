# BabyLoop Architecture Decisions

## Purpose

This document records architecture decisions that guide BabyLoop development.

These decisions exist to prevent uncontrolled feature growth, inconsistent contracts, and repeated refactors.

## AD-001: Web Must Not Access Database Directly

### Decision

The Next.js web app must not import or use `packages/database` directly.

Allowed flow:

```text
apps/web -> apps/api -> packages/database
```

### Reason

The API owns authorization, validation, audit logging, and future moderation checks.

## AD-002: Messaging Uses One Conversation Per Profile Pair

### Decision

BabyLoop messaging uses exactly one conversation channel between two profiles.

Listings do not create separate conversations. Listings are attached to the existing profile-pair conversation through `conversation_listing_contexts`.

The conversation uniqueness mechanism is the normalized profile pair:

- `profile_low_id`
- `profile_high_id`

`conversation_participants` may exist for access checks and future flexibility, but it must not be the only uniqueness mechanism.

### Reason

Parents may discuss multiple listings with the same seller. A single profile-pair channel avoids fragmented threads while preserving listing context.

### Do Not Regress

- Do not revert messaging to listing-based conversations.
- Do not create separate conversations per listing.
- Do not remove `conversation_listing_contexts`.
- Do not use `buyer_profile_id` or listing id as the conversation uniqueness basis.

## AD-003: Rental Listings Are Deferred From MVP Scope

### Decision

BabyLoop MVP supports these active listing types:

- `sale`
- `donation`
- `swap`

BabyLoop MVP does not allow users to create rental listings.

The API create-listing contract must reject `listingType: "rent"`, and the web sell form must not show a Rent option.

The PostgreSQL enum may still contain `rent` as legacy/internal compatibility until a separate safe enum migration plan exists. Do not remove enum values casually because PostgreSQL enum removal is migration-sensitive and old local/shared data may still contain `rent`.

### Reason

Rent introduces deposit, date range, return, damage, contract, payment, and dispute flows. Those require product, legal, trust-and-safety, and payment design that is intentionally outside the current MVP.

### Do Not Regress

- Do not show Rent in the sell form.
- Do not accept `listingType: "rent"` in create-listing API requests.
- Do not remove `rent` from the database enum without a dedicated migration plan.
- Do not implement rental payments, deposits, date ranges, or return/dispute flows in MVP cleanup tasks.

## AD-004: Manual Image URLs Are Temporary Development Bridge

### Decision

BabyLoop currently accepts `imageUrls` during listing creation and stores image URL metadata.

This is temporary development-only behavior. Manual image URL entry is not acceptable for production marketplace listings.

The field must remain available until a real upload flow exists so current local development and regression tests keep working.

Future production upload work should add:

- signed upload URLs
- durable storage
- file type validation
- file size limits
- image metadata persistence
- safety/moderation hooks before broad marketplace distribution

### Reason

Real listing photos need controlled upload, storage, validation, and auditability. Manual arbitrary URLs are useful while the marketplace foundation is being built, but they are not safe or ergonomic for parents and sellers in production.

### Do Not Regress

- Do not claim image upload exists until files can actually be uploaded.
- Do not remove `imageUrls` before a replacement upload flow exists.
- Do not add storage SDKs or schema changes without a focused upload implementation plan.
- Keep validation strict for the temporary URL flow: valid URLs only and max 5 images.
