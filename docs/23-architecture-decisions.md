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


<!-- 2026-06-11-backoffice-privacy-redaction-foundation -->
## 2026-06-11 Update — Backoffice Data Privacy + Redaction Foundation

### Decision: Public web and backoffice remain separate applications

Decision remains active.

- `apps/web` is the public marketplace application.
- `apps/backoffice` is the dedicated internal admin/backoffice application.
- `apps/api` is the shared backend.
- Public admin redirects are allowed only as legacy navigation helpers.

Reason:

- Admin code must not grow inside the public web bundle.
- Moderation, trust & safety, support, audit, and AI tooling require a different privacy model.
- Public DTOs and backoffice DTOs have different exposure rules.

### Decision: Backoffice masking is not security

UI masking is not sufficient.

Sensitive data must not reach the browser unless the permissioned sensitive-access endpoint explicitly allows access and records an audit event.

### Decision: Server-side redaction boundary

Admin moderation responses must be produced through a minimized/redacted DTO boundary.

Reporter identity is redacted by default.

Message body previews are generated server-side.

Raw message body and conversation ID are not returned in default admin moderation responses.

### Decision: Permissioned sensitive access is separate and audited

Raw reporter identity and raw message body access uses a separate endpoint:

```txt
POST /api/v1/admin/moderation/cases/:caseId/sensitive-access
```

The first version is deliberately narrow:

- request body must include an explicit `reason`
- request body must include allowlisted `fields`
- current allowed fields are `reporter` and `message`
- access goes through a dedicated sensitive-access helper
- successful access writes an `events` audit row before data is returned
- denied access writes an `events` audit row when actor and case context are safely available
- default list/detail endpoints remain redacted

Audit metadata must not store raw message bodies, reporter emails, tokens, full profile data, full listing data, or full conversation data. Granted audits currently keep the operator-entered reason for compatibility; denied audits avoid storing the free-text reason.

The current compatibility permission gate allows admins through the dedicated helper. Granular permissions remain a future architecture item.

### Decision: Moderation triage filters stay on redacted DTOs

Backoffice moderation list filters are operational triage controls, not sensitive-data access controls.

`GET /api/v1/admin/moderation/cases` may filter by status, target type, safe search text, sort, and limit, and may return summary counts for the current safe result set.

Search is intentionally limited to case/report/target identifiers and non-sensitive moderation metadata. It must not search raw message bodies, reporter identity, email addresses, conversation participants, tokens, or session metadata.

Sensitive access remains a separate explicit endpoint with reason and audit requirements.

### Decision: Audit timeline is safe metadata only

Backoffice case detail may compose a timeline from moderation actions and related `events` rows.

The timeline is an operator-readability feature, not a raw-data access path. Sensitive-access granted/denied audit events may be visible, but only through server-side allowlisted metadata.

Unknown audit metadata must not be returned or rendered blindly. Raw message bodies, reporter emails, tokens, full profile/listing/conversation data, and conversation participants remain outside the default detail response.

### Decision: AI remains human-in-the-loop

AI may provide:

- Summaries
- Risk explanations
- Classification suggestions
- Recommended next actions

AI must not:

- Resolve cases automatically
- Dismiss cases automatically
- Block users automatically
- Delete listings automatically
- Receive unnecessary raw private data

### Future architecture decision required

A future ADR is still required for:

```txt
Granular Sensitive Data Permissions + Retention Policy
```

That ADR should define:

- Permission names
- Retention policy
- Backoffice UI affordance
- Denied-access audit policy
