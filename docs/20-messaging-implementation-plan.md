# Messaging Implementation Plan

## Goal

Add a minimal authenticated messaging slice for listing-based buyer/seller conversations without realtime, attachments, AI moderation, or notifications yet.

Messaging must preserve BabyLoop ownership rules:

- `profile_id` must never come from user-facing client flows.
- Current profile must always come from the verified auth token.
- Conversation read/send access must be participant-only.
- Users must not be able to message themselves for their own listing.

## Conversation Model

`conversations` represents one listing-centered thread between two marketplace profiles.

Suggested fields:

| Field | Notes |
| --- | --- |
| `id` | UUID primary key. |
| `listing_id` | Required FK to `listings.id`. |
| `buyer_profile_id` | Profile that started the conversation. Derived from token. |
| `seller_profile_id` | Listing owner. Derived from listing. |
| `status` | `active`, future `closed`, future `restricted`. |
| `last_message_at` | Nullable timestamp for sorting. |
| `created_at` | Timestamp. |
| `updated_at` | Timestamp. |

Add a unique constraint on `(listing_id, buyer_profile_id, seller_profile_id)` so repeated starts return the same conversation.

## Participants Model

For the first slice, participants can be represented by `buyer_profile_id` and `seller_profile_id` on `conversations`.

Delay a separate `conversation_participants` table until group conversations, archived state, per-user unread counters, or participant-specific settings are needed.

Participant rule:

- current profile is a participant if it matches `buyer_profile_id` or `seller_profile_id`.

## Messages Model

`messages` stores plain text messages only.

Suggested fields:

| Field | Notes |
| --- | --- |
| `id` | UUID primary key. |
| `conversation_id` | Required FK to `conversations.id`. |
| `sender_profile_id` | Derived from token. Must be a participant. |
| `body` | Plain text, trimmed, length-limited. |
| `status` | `sent`, future `hidden`, future `flagged`. |
| `created_at` | Timestamp. |

No attachments, read receipts, edits, deletes, or moderation fields in the first slice.

## Listing-Based Conversations

First endpoint should create or return an existing conversation for a listing.

Flow:

1. Authenticated user requests conversation for `listingId`.
2. API loads listing and seller profile.
3. API rejects if current profile is the seller.
4. API inserts or returns conversation for current buyer and seller.
5. API returns safe conversation summary.

The client should send only `listingId`, never buyer/seller/profile ids.

## Auth Requirement

All messaging endpoints require `Authorization: Bearer <token>`.

Public marketplace read endpoints remain public, but conversations and messages are private.

## Seller/Buyer Ownership Rules

Buyer:

- can create conversation for another seller's listing.
- can list conversations where they are buyer or seller.
- can read/send messages only in conversations where they are a participant.

Seller:

- cannot create a conversation with themselves for their own listing.
- can reply in conversations for their listings if they are a participant.

API must derive:

- buyer from current token profile.
- seller from listing ownership.
- sender from current token profile.

## Participant-Only Read/Send Rules

Every conversation/message route must check participant access before returning data or inserting messages.

Rules:

- non-participant `GET conversation messages` returns `403`.
- non-participant `POST message` returns `403`.
- missing auth returns `401`.
- nonexistent conversation returns `404` only after safe access checks where appropriate.

## First Slice

Endpoints:

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/api/v1/conversations` | Create or return listing conversation. |
| `GET` | `/api/v1/conversations` | List my conversations. |
| `GET` | `/api/v1/conversations/:id/messages` | List messages in a conversation. |
| `POST` | `/api/v1/conversations/:id/messages` | Send plain text message. |

Request contracts:

- `POST /conversations`: `{ "listing_id": "uuid" }`
- `POST /conversations/:id/messages`: `{ "body": "plain text" }`

First web flow:

- listing detail can later show a "Message seller" action for logged-in non-sellers.
- conversations page can later list threads and messages.

Do not build web UI in the first database/API planning step unless explicitly requested.

## Future AI Moderation Hook

Later, before message persistence or before delivery:

1. validate message body.
2. call AI moderation engine.
3. log `ai_model_runs`.
4. allow, warn, block, or queue for moderation based on behavior-based risk.

Do not add direct gender-based restrictions. Risk scoring must be behavior-based.

First slice should keep a clear insertion point, but should not call AI moderation yet.

## Future Reporting and Blocking

Delayed tables/features:

- `message_reports`
- `profile_blocks`
- conversation restrictions
- moderator queue
- admin review UI
- abuse evidence timeline

Blocking/reporting must be designed with audit logs and human review for serious actions.

## Future Realtime

Delayed realtime options:

- polling first
- Server-Sent Events
- WebSocket gateway
- hosted realtime provider

Do not add realtime in the first slice. Plain request/response endpoints are enough.

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

- migration creates `conversations` and `messages`.
- unique listing/buyer/seller conversation constraint works.
- seed data remains compatible.

API:

- unauthenticated conversation create returns `401`.
- authenticated user can create conversation for another seller's listing.
- seller cannot create conversation for own listing.
- repeated create returns existing conversation.
- user can list only own conversations.
- participant can list messages.
- non-participant cannot list messages.
- participant can send plain text message.
- non-participant cannot send message.
- invalid/empty message body returns `400`.
- no response leaks private profile data beyond safe display fields.

Web, when added:

- logged-out users see login requirement.
- logged-in buyer can start a conversation from listing detail.
- browse/detail remain public.

Build:

- `pnpm typecheck`
- `pnpm build`

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

