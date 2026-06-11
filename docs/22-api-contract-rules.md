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


<!-- 2026-06-11-backoffice-privacy-redaction-foundation -->
## 2026-06-11 Update — Backoffice Data Privacy + Redaction Foundation

### Backoffice moderation privacy contract

Backoffice API responses must use dedicated internal DTOs.

The backoffice UI is not a security boundary. Sensitive data must be minimized or redacted before it leaves `apps/api`.

Default admin moderation responses may include:

```txt
case.id
case.targetType
case.targetId
case.status
case.priority
case.createdAt
case.updatedAt
report.id
report.reason
report.status
report.createdAt
report.reporter.redacted
targetPreview
actions
```

Default admin moderation responses must not include:

```txt
reporter.email
reporter.phone
reporter.profileId
reporter.displayName
raw message body
conversationId
conversation participant ids
private profile fields
auth/session metadata
```

### Reporter contract

Allowed default reporter shape:

```ts
reporter: {
  redacted: true
} | null
```

Disallowed default reporter shape:

```ts
reporter: {
  id: string;
  displayName: string;
}
```

Reporter raw identity access is available only through the separate permissioned sensitive-access endpoint:

```txt
POST /api/v1/admin/moderation/cases/:caseId/sensitive-access
```

That endpoint requires admin authentication, the dedicated sensitive-access gate, an explicit reason, an allowlisted field request, and an audit event before returning data.

Denied attempts are audited when actor and case context are safely available. Unauthenticated requests and malformed case ids may not create DB audit rows.

### Moderation triage list contract

`GET /api/v1/admin/moderation/cases` supports safe triage filters for status, target type, search, sort, and limit.

Allowed query fields:

```txt
status
targetType
q
sort
limit
```

The list search is limited to safe operational fields such as case id, report id, target id, target type, status, and report reason/status. It must not search or return raw reporter identity, raw message body, conversation participants, profile emails, tokens, or session metadata.

The response may include summary metadata for the current safe result set. Summary counts are operational triage data only; they are not a raw sensitive-data view and must not require or trigger sensitive access.

### Moderation detail timeline contract

Default moderation case detail responses may include a composed `timeline` array with safe case, report, moderation action, and audit-event entries.

The timeline may show sensitive-access granted/denied audit events only as safe operational metadata, such as:

```txt
requestedFields
grantedFields
deniedFields
targetType
targetId
denialReason
status
actionType
```

Timeline metadata must be allowlisted server-side. Unknown metadata must be omitted rather than rendered blindly.

Timeline responses must not include raw message body, reporter email, user email, phone numbers, tokens, refresh tokens, auth/session metadata, full profile/listing/conversation data, or conversation participants.

### Message target preview contract

Message previews must be generated server-side.

Allowed shape:

```ts
{
  type: "message";
  id: string;
  bodyPreview: string;
  createdAt: string;
}
```

Disallowed fields:

```txt
body
rawBody
conversationId
senderProfileId
senderEmail
senderPhone
participants
```

### Listing/profile target preview contract

Listing/profile previews may only return minimal safe fields.

Listing preview:

```ts
{
  type: "listing";
  id: string;
  title: string;
  status: string;
}
```

Profile preview:

```ts
{
  type: "profile";
  id: string;
  displayName: string;
}
```

The string values must be safe/redacted server-side before returning.

### Regression rule

Every future admin/backoffice moderation response change must include tests proving that the response does not expose:

- Reporter email
- Reporter profile ID
- Reporter display name
- Phone numbers
- Email addresses
- Raw message body
- Conversation ID

### Sensitive access contract

Default moderation list/detail endpoints remain redacted.

Raw sensitive data may be returned only by `POST /api/v1/admin/moderation/cases/:caseId/sensitive-access`.

Current allowed fields:

```txt
reporter
message
```

The endpoint must not expose:

```txt
conversation participants
full conversation data
full profile data
full listing data
auth/session metadata
```

The public web app must not call this endpoint.

AI tools must not use raw sensitive data by default. Any future AI flow that needs raw access must have an explicit permission and audit design.

Sensitive-access audit metadata must not include raw message bodies, reporter email, tokens, full profile data, full listing data, or full conversation data.
