# Messaging Implementation Plan

## Goal

Add a minimal authenticated messaging slice for marketplace conversations without realtime, attachments, AI moderation, or notifications yet.

Messaging must preserve BabyLoop ownership rules:

- `profile_id` must never come from user-facing client flows.
- Current profile must always come from the verified auth token.
- Conversation read/send access must be participant-only.
- Users must not be able to message themselves for their own listing.

## Canonical Conversation Model

BabyLoop uses exactly one conversation channel between two profiles.

A listing does not create a separate conversation. When a buyer starts messaging about a listing, the API creates or reuses the existing profile-pair conversation and attaches the listing through `conversation_listing_contexts`.

`conversations` represents the profile-pair channel.

| Field | Notes |
| --- | --- |
| `id` | UUID primary key. |
| `profile_low_id` | Lower sorted profile id in the pair. |
| `profile_high_id` | Higher sorted profile id in the pair. |
| `created_by_profile_id` | Profile that first created the channel. |
| `status` | `active`, future `closed`, future `restricted`. |
| `last_message_at` | Nullable timestamp for sorting. |
| `created_at` | Timestamp. |
| `updated_at` | Timestamp. |

Uniqueness is enforced by the normalized profile pair, not by a listing id.

## Listing Contexts

`conversation_listing_contexts` records which listings have been discussed in a profile-pair conversation.

| Field | Notes |
| --- | --- |
| `id` | UUID primary key. |
| `conversation_id` | FK to `conversations.id`. |
| `listing_id` | FK to `listings.id`. |
| `added_by_profile_id` | Profile that attached the listing context. |
| `created_at` | Timestamp. |

The same two profiles can discuss multiple listings in the same conversation.

## Participants Model

`conversation_participants` remains for access checks and future flexibility.

It should not be the only uniqueness mechanism. The conversation pair uniqueness belongs on `conversations(profile_low_id, profile_high_id)`.

Participant rule:

- current profile must exist in `conversation_participants` for the conversation.

## Messages Model

`messages` stores plain text messages only.

| Field | Notes |
| --- | --- |
| `id` | UUID primary key. |
| `conversation_id` | Required FK to `conversations.id`. |
| `sender_profile_id` | Derived from token. Must be a participant. |
| `body` | Plain text, trimmed, non-empty, max 5000 characters. |
| `created_at` | Timestamp. |
| `deleted_at` | Nullable future soft-delete timestamp. |

No attachments, read receipts, edits, hard deletes, or moderation fields in the first slice.

## Create Conversation Flow

First endpoint creates or returns the existing profile-pair conversation for a listing context.

Flow:

1. Authenticated user requests conversation for `listingId`.
2. API loads the active listing and seller profile.
3. API rejects if current profile is the seller.
4. API normalizes current profile and seller profile into `profile_low_id` and `profile_high_id`.
5. API inserts or returns the existing profile-pair conversation.
6. API inserts `conversation_participants` rows for both profiles.
7. API attaches the listing through `conversation_listing_contexts`.
8. API returns safe conversation summary.

The client sends only `listingId`, never buyer/seller/profile ids.

## Auth Requirement

All messaging endpoints require `Authorization: Bearer <token>`.

Public marketplace read endpoints remain public, but conversations and messages are private.

## Ownership Rules

Buyer:

- can create or reuse a conversation for another seller's listing.
- can list conversations where they are a participant.
- can read/send messages only in conversations where they are a participant.

Seller:

- cannot create a conversation with themselves for their own listing.
- can reply in conversations where they are a participant.

API must derive:

- current profile from token.
- seller from listing ownership.
- sender from token.
- listing context from `listingId`.

## Participant-Only Read/Send Rules

Every conversation/message route must check participant access before returning data or inserting messages.

Rules:

- non-participant `GET conversation messages` returns `403`.
- non-participant `POST message` returns `403`.
- missing auth returns `401`.
- nonexistent conversation returns `404`.

## First Slice

Endpoints:

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/api/v1/conversations` | Create or return profile-pair conversation and attach listing context. |
| `GET` | `/api/v1/conversations` | List my conversations. |
| `GET` | `/api/v1/conversations/:id` | Read one conversation summary as a participant. |
| `GET` | `/api/v1/conversations/:id/messages` | List messages in a conversation. |
| `POST` | `/api/v1/conversations/:id/messages` | Send plain text message. |

Request contracts:

- `POST /conversations`: `{ "listingId": "uuid" }`
- `POST /conversations/:id/messages`: `{ "body": "plain text" }`

Implemented web flow:

- listing detail shows a "Message seller" action for logged-in non-sellers.
- listing detail prevents or redirects unauthenticated users to login.
- `/conversations` lists authenticated user's conversations.
- `/conversations/[id]` shows the conversation thread.
- the thread page includes a plain text message composer.

Not implemented in the web flow yet:

- realtime updates
- unread state
- report/block actions
- attachments
- AI moderation indicators

## Future AI Moderation Hook

Later, before message persistence or before delivery:

1. validate message body.
2. call AI moderation engine.
3. log `ai_model_runs`.
4. allow, warn, block, or queue for moderation based on behavior-based risk.

Do not add direct gender-based restrictions. Risk scoring must be behavior-based.

## Future Reporting and Blocking

Delayed tables/features:

- `message_reports`
- `profile_blocks`
- conversation restrictions
- moderator queue
- admin review UI
- abuse evidence timeline

## Future Realtime

Delayed realtime options:

- polling first
- Server-Sent Events
- WebSocket gateway
- hosted realtime provider

Do not add realtime in the first slice.

## Future Notifications

Delayed notification hooks:

- app notification
- email
- WhatsApp
- Telegram
- push notification

First slice can update `last_message_at`, but should not send external notifications.

## Verification Checklist

Database:

- `conversations` uses normalized profile-pair uniqueness.
- `conversation_listing_contexts` attaches listing context.
- `conversation_participants` exists for access/future flexibility.
- message body constraints reject blank messages.
- seed data remains compatible.

API:

- unauthenticated conversation create returns `401`.
- authenticated user can create/reuse conversation for another seller's active listing.
- seller cannot create conversation for own listing.
- repeated create for the same profile pair returns existing conversation.
- repeated create for another listing between the same profiles attaches another listing context.
- user can list only own conversations.
- participant can list messages.
- non-participant cannot list messages.
- participant can send plain text message.
- invalid/empty message body returns `400`.

Build:

- `pnpm typecheck`
- `pnpm build`

## Do Not Regress

- Do not revert messaging to listing-based conversations.
- Do not create separate conversations per listing.
- Do not remove `conversation_listing_contexts`.
- Do not use listing id as the conversation uniqueness basis.

## Delayed Features

Do not include in the first slice:

- realtime
- attachments
- AI moderation
- reporting/blocking
- notifications
- read receipts
- message edits/deletes
- group conversations
- admin moderation UI
- mobile messaging UI

## Messaging safety full-flow boundary

Run pnpm security:messaging-safety-full-flow before claiming messaging release readiness.

The messaging safety full-flow boundary confirms that unsafe message bodies are rejected before persistence, notification creation, and realtime publish. Public conversation and realtime payloads must not expose email, phone, accessToken, refreshToken, cookie, authorization, passwordHash, or raw auth/session data.

This does not add a new realtime provider or a new chat system.

Messaging safety full-flow boundary does not expose email, does not expose phone, does not expose accessToken, does not expose refreshToken, does not expose cookie, and does not expose authorization in public, realtime, or admin default DTOs.
