<!-- 2026-06-11-backoffice-privacy-redaction-foundation -->

# Backoffice Data Privacy and Redaction Foundation

## Purpose

Backoffice APIs must not expose raw sensitive user data by default.

The backoffice UI is not a security boundary. Sensitive data must be minimized or redacted before it leaves the API.

## Current active task

```txt
Backoffice Data Privacy + Redaction Foundation
```

This task follows the completion of the first usable backoffice moderation list/detail flow.

## Scope

This policy applies to:

- Admin moderation case list responses
- Admin moderation case detail responses
- Target previews for listings, profiles, and messages
- Report metadata
- Reporter identity
- Message body previews
- Future AI moderation summaries and recommendations

## Sensitive data classes

### Direct PII

- Email address
- Phone number
- Full name when not required for the workflow
- Address or exact location
- Authentication/session metadata
- Private profile identifiers when not required

### Private platform data

- Raw message body
- Conversation ID
- Conversation participant IDs
- Reporter profile ID
- Reporter display name
- Seller/buyer identity when not required for the moderation decision

### Operationally sensitive data

- Admin/internal actor IDs
- Internal audit metadata
- Raw AI prompts and completions
- Safety classifier raw payloads

## Default backoffice API rule

Admin/backoffice responses must return minimized DTOs.

Default responses may include:

- Case ID
- Target type
- Target ID
- Status
- Priority
- Created/updated timestamps
- Report reason/status
- Redacted reporter marker
- Safe target preview

Default responses must not include:

- Reporter email
- Reporter phone
- Reporter profile ID
- Reporter display name
- Raw message body
- Conversation ID
- Conversation participants
- Raw private profile fields

## Reporter rule

Reporter identity is redacted by default.

Allowed default marker:

```ts
reporter: {
  redacted: true
}
```

Reporter raw identity access requires the dedicated permissioned sensitive-access endpoint and audit logging.

## Message preview rule

Message previews must be generated server-side.

Message previews must:

- Normalize whitespace
- Redact email addresses
- Redact phone numbers
- Apply a maximum preview length
- Never include the raw message body field
- Never include conversation ID by default

Allowed message preview shape:

```ts
{
  type: "message";
  id: string;
  bodyPreview: string;
  createdAt: string;
}
```

## Listing/profile preview rule

Listing and profile previews must be minimized.

Allowed listing preview fields:

- `id`
- redacted/safe `title`
- `status`

Allowed profile preview fields:

- `id`
- redacted/safe `displayName`

No email, phone, user ID, session data, or private profile data may be included.

## Sensitive raw access rule

Raw sensitive access uses a separate endpoint.

Required controls:

- Explicit permission check
- Explicit access reason
- Audit event
- Minimal response
- No AI destructive action
- No public web exposure

Implemented endpoint:

```txt
POST /api/v1/admin/moderation/cases/:caseId/sensitive-access
```

Allowed fields:

```txt
reporter
message
```

The endpoint writes an `events` row with `eventType = admin_sensitive_access_granted` before returning raw data.

Denied attempts write `eventType = admin_sensitive_access_denied` when actor and moderation-case context are safely available. Examples include known non-admin actors, invalid request bodies for a known case, valid-but-missing case ids, and fields that are unavailable for the target case.

The current permission helper allows admins as a compatibility gate. Granular sensitive-data permissions are still future work.

Denied access is returned as a safe API error. Unauthenticated requests and malformed case ids may not create audit rows because actor/case context is unavailable.

Backoffice UI access is explicit. Case detail does not auto-fetch raw data. Admins must open the sensitive-access panel, enter a reason, select fields, and submit. Returned raw data is displayed only after the audited request succeeds and can be cleared from component state.

## Timeline audit visibility rule

Case detail may show a combined moderation timeline.

Allowed timeline content:

- case/report context
- moderation notes/actions
- status changes
- sensitive-access granted/denied audit event labels
- allowlisted operational metadata such as requested/granted/denied fields, target type/id, status, action type, and denial reason

Timeline metadata must be allowlisted by the API before it reaches the backoffice UI.

The timeline must not show raw message body, reporter email, user email, phone numbers, tokens, refresh tokens, auth/session metadata, full profile/listing/conversation data, or conversation participants.

The timeline is not a raw-data viewer and must not call the sensitive-access endpoint.

## Enforcement privacy rule

Backoffice enforcement controls must not expose raw sensitive data.

Enforcement responses and timeline metadata may include:

- enforcement action
- target type
- target id
- resulting status
- moderation action id
- audit event id

They must not include raw message body, reporter email, user email, phone numbers, tokens, refresh tokens, auth/session metadata, full profile/listing/conversation data, or conversation participants.

Sensitive access remains separate from enforcement. Enforcement UI must not call the sensitive-access endpoint.

## Listing review privacy rule

Backoffice listing review tools use dedicated admin listing DTOs.

Allowed listing review data:

- listing id, title, public description, price, currency, status, listing type, condition, created/updated timestamps
- category id/name/slug
- listing image id/url/sort order/created timestamp
- image counts and primary image preview
- seller profile id, display name, city, and profile creation timestamp
- related moderation case id/status/target/reason/status timestamps
- listing-scoped audit metadata that has been allowlisted

Listing review responses must not include seller email, seller phone, raw user objects, raw profile objects, reporter identity, raw message body, conversation participants, tokens, refresh tokens, or auth/session metadata.

Listing-scoped archive/restore actions are audited with `events.eventType = admin_listing_action_applied`. Audit metadata may include listing id, action, previous/next status, and reason length. It must not store seller contact data, reporter identity, message bodies, tokens, or raw profile/user data.

Listing review is not a sensitive-access path and must not call `POST /api/v1/admin/moderation/cases/:caseId/sensitive-access`.

## AI rule

AI may only provide:

- Summary
- Classification suggestion
- Recommended next action
- Risk explanation

AI must not:

- Resolve/dismiss cases automatically
- Block users automatically
- Delete listings automatically
- Expose raw PII in generated text
- Receive unnecessary raw private data

## Regression requirements

Tests must verify that admin moderation responses do not expose:

- Reporter email
- Reporter profile ID
- Reporter display name
- Phone numbers
- Email addresses
- Raw message body
- Conversation ID

## Validation commands

```bash
pnpm --filter @babyloop/api test -- redaction.service.test.ts admin-moderation.integration.test.ts
pnpm --filter @babyloop/api typecheck
pnpm --filter @babyloop/backoffice typecheck
pnpm typecheck
pnpm build
```
