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

## AD-004: Listing Images Use Safe Upload Storage, Manual URLs Are Compatibility

### Decision

BabyLoop supports local listing image upload for development and test through `var/uploads`, plus a safe API media route. PostgreSQL stores image metadata and public relative URLs only, not raw image bytes.

BabyLoop still accepts `imageUrls` during listing creation as compatibility metadata for existing local development and regression coverage. Manual arbitrary URL entry is not acceptable as the primary production marketplace photo flow.

Production storage now has an S3/R2-compatible driver, image normalization foundation, and listing-scoped duplicate-image content hash detection. Remaining storage hardening includes dedicated upload frequency/quota controls, fraud scoring for cross-listing duplicate images, and broader image moderation validation. CDN/cache and public media URL boundaries are guarded through local immutable cache headers, S3/R2 public base URL validation, capped proxy memory cache settings, and the upload/storage boundary guard.

Current upload safety includes:

- file type validation
- file size limits
- MIME/extension/magic-byte checks
- SVG rejection
- max image count
- path traversal prevention
- no original filename trust

Future production upload work should add:

- signed or direct object-storage uploads
- durable object storage
- resize/thumbnail transforms
- EXIF stripping
- image moderation hooks
- image metadata persistence

### Reason

Real listing photos need controlled upload, storage, validation, and auditability. Manual arbitrary URLs are useful while the marketplace foundation is being built, but they are not safe or ergonomic for parents and sellers in production.

### Do Not Regress

- Do not store raw image bytes/base64 in PostgreSQL.
- Do not commit uploaded image files or local upload folders.
- Do not remove `imageUrls` until compatibility requirements are retired deliberately.
- Do not add storage SDKs or schema changes without a focused upload implementation plan.
- Keep validation strict for the temporary URL flow: valid URLs only and max 5 images.

## AD-005: Backoffice Uses HttpOnly Cookie Auth, Public Bearer Compatibility Remains

### Decision

Backoffice admin access tokens must not be stored in browser `localStorage` or `sessionStorage`.

Backoffice uses dedicated auth endpoints:

```txt
POST /api/v1/auth/backoffice/login
POST /api/v1/auth/backoffice/refresh
POST /api/v1/auth/backoffice/logout
GET /api/v1/auth/backoffice/me
```

Successful backoffice login/refresh sets `babyloop_backoffice_access_token` as an httpOnly cookie. The API auth plugin still accepts `Authorization: Bearer` first for public app compatibility, then falls back to the explicit backoffice access cookie.

### Reason

Backoffice has higher-risk moderation and marketplace operations. Removing readable admin access tokens from browser storage reduces XSS token theft risk while keeping public auth compatibility stable.

### CSRF Posture

The first hardening step relies on httpOnly cookies, SameSite=Lax, credentialed CORS origin restrictions, and admin-only authorization. A full CSRF token mechanism remains future work and should be added before broader cross-site deployment assumptions change.

### Do Not Regress

- Do not store backoffice access tokens in `localStorage`, `sessionStorage`, readable cookies, URLs, or logs.
- Do not return access tokens from `/auth/backoffice/login` or `/auth/backoffice/refresh`.
- Do not remove Bearer-token support until public web auth has a separate migration.


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

### Decision: Enforcement uses existing reversible states first

Backoffice enforcement must prefer existing safe schema states over broad migrations.

The first enforcement slice uses:

- `listings.status = archived` for listing hide
- `listings.status = active` for listing restore
- `messages.deleted_at` for message hide
- moderation action/audit event only for message reviewed
- `profiles.safety_status` for profile restriction, suspension, and restoration

Profile warning is audit-only. Profile restriction and suspension block listing creation and message sending. Suspended seller listings are hidden from public listing list/detail queries. Listing `under_review` is still deferred because it is not an existing listing status.

Every enforcement action requires admin auth, a valid moderation case, a compatible target type, an explicit reason, and an audit/timeline event.

### Decision: Listing admin review is listing-scoped, not sensitive access

Backoffice listing review tools use separate admin listing endpoints:

```txt
GET /api/v1/admin/listings
GET /api/v1/admin/listings/:listingId
POST /api/v1/admin/listings/:listingId/actions
```

These endpoints support marketplace operations on listing records and must not call or replace the permissioned sensitive-access endpoint.

Admin listing DTOs may include safe listing fields, category summary, read-only image metadata, seller profile id/display name/city, and related moderation case summaries. They must not include seller email, seller phone, raw user/profile objects, reporter identity, raw message body, conversation participants, tokens, or auth/session metadata.

Listing-scoped actions currently support `archive` and `restore`, mapped to existing `listings.status` values `archived` and `active`. Listing `under_review`, image approve/reject, and profile enforcement remain deferred until the schema supports safe states.

Listing action audit events use `admin_listing_action_applied` and store only safe metadata such as listing id, action, previous/next status, and reason length.

Listing-scoped archive/restore actions must reject no-op transitions server-side. `archive` is valid only when the listing is not already archived. `restore` is valid only when the listing is archived. Rejected no-op transitions must not write audit events.

### Decision: Rejected listing images are hidden publicly, visible to admins

Listing image review uses `listing_images.review_status` with `approved` and `rejected`.

Images default to `approved` so existing listings and new uploads continue to work. Public listing queries must fetch approved images only. Admin listing detail may fetch all images and include safe review metadata.

Image review actions are listing-scoped marketplace operations:

```txt
POST /api/v1/admin/listings/:listingId/images/:imageId/actions
```

They write `admin_listing_image_review_applied` events and store only safe metadata. Raw reasons, image bytes, seller contact data, reporter identity, message bodies, tokens, and raw profile/user objects must not be stored in audit metadata.

Image approve/reject actions must reject no-op transitions server-side. `approve` is valid only for rejected images. `reject` is valid only for approved images. Rejected no-op transitions must not write audit events.

Owner listing image URL updates must preserve matching existing `listing_images` rows so admin review state is not silently reset. Public listing queries use approved-only helpers, owner routes use owner-safe image sets without review metadata, and admin listing detail uses all image rows with safe review metadata.

### Decision: Dashboard MVP is aggregate-only

The backoffice dashboard summary endpoint:

```txt
GET /api/v1/admin/dashboard/summary
```

returns aggregate counts only. It is not an audit-log browser, user directory, or sensitive-data viewer. It must not expose identities, raw event metadata, message content, private profile/user data, or auth/session data.

### Decision: Audit browser is safe metadata only

The admin audit browser endpoint:

```txt
GET /api/v1/admin/audit/events
```

returns event id, type, entity type/id, actor profile id, timestamp, and server-side allowlisted metadata only.

It must not return raw metadata wholesale and must not expose raw reasons, emails, phone numbers, message bodies, profile/listing/message objects, tokens, cookies, password hashes, or auth/session internals. Query search is limited to safe ids and event/entity types, not metadata text.

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
