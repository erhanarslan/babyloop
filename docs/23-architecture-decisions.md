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
