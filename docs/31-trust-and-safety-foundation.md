# Trust and Safety Foundation

## Purpose

BabyLoop now has a first Trust & Safety foundation for reporting, blocking, and moderation case creation. This is not a full admin or fraud system yet; it is the backend and minimal web surface needed to collect user safety signals safely.

## Implemented

Report targets:

- listings
- profiles
- messages

Block behavior:

- authenticated users can block another profile
- users cannot block themselves
- block and unblock are idempotent
- blocked profile pairs cannot start new conversations
- blocked profile pairs cannot send messages in either direction
- existing conversations remain readable for participants

Moderation foundation:

- each new report creates a `reports` row
- each new report creates a `moderation_cases` row
- each new report creates a `user_safety_events` row
- duplicate reports by the same reporter for the same target are idempotent
- moderation actions table exists for future admin review/audit work

Minimal web entry points:

- listing detail: report listing
- conversation detail: report user
- conversation detail: block/unblock user
- conversation messages: report incoming message

## API Endpoints

Reports:

- `POST /api/v1/reports/listings/:listingId`
- `POST /api/v1/reports/profiles/:profileId`
- `POST /api/v1/reports/messages/:messageId`

Blocks:

- `POST /api/v1/profiles/:profileId/block`
- `DELETE /api/v1/profiles/:profileId/block`
- `GET /api/v1/profiles/blocked`

## Report Rules

- auth is required
- reason is required
- details are optional safe plaintext
- users cannot report themselves
- users cannot report their own listings
- message reports require conversation participation
- nonexistent targets return a controlled not-found response
- duplicate reports are safe and do not create uncontrolled duplicate cases

Allowed reasons:

- `safety`
- `scam`
- `inappropriate`
- `prohibited_item`
- `harassment`
- `other`

## Privacy and Security Notes

- block/list responses expose only minimal profile display data
- report responses do not expose private user data
- favorite actor privacy remains separate and must not regress
- message bodies remain plaintext only
- report details use the same plaintext/XSS safety policy as other user-generated text

## Still Missing

- full admin moderation UI
- admin queue assignment and review states
- escalation workflow
- appeal flow
- fraud detection
- off-platform payment warning flow
- unsafe baby product warning flow
- AI moderation assistance
- image moderation
- moderation analytics and SLA tracking

## Manual QA Checklist

- Login as Ayse.
- Report Mehmet's listing.
- Confirm success UI.
- Report Mehmet's profile from conversation detail.
- Report an incoming message.
- Block Mehmet.
- Confirm the composer is disabled or sending is blocked.
- Unblock Mehmet.
- Confirm messaging can resume if Mehmet has not also blocked Ayse.
- Confirm no email, user id, or private profile data appears in report/block responses.

## Future Admin Moderation Plan

The next admin foundation should build on `moderation_cases` and `moderation_actions` by adding:

- admin-only case list API
- admin-only case detail API
- action logging
- status transitions
- reviewer assignment if needed
- safe redaction rules for user-generated content


<!-- 2026-06-11-backoffice-privacy-redaction-foundation -->
## 2026-06-11 Update — Backoffice Data Privacy + Redaction Foundation

### Privacy rule added to trust & safety foundation

Trust & safety features must default to data minimization.

Backoffice users may be admins, but admin access does not automatically justify exposing all sensitive data in default responses.

### Moderation case data classes

#### Low-risk metadata

Allowed by default:

- Case ID
- Target type
- Target ID
- Case status
- Priority
- Created/updated timestamps
- Report reason/status
- Redacted reporter marker

#### Sensitive user data

Not allowed by default:

- Reporter profile ID
- Reporter display name
- Reporter email
- Reporter phone
- Raw message body
- Conversation ID
- Conversation participants
- User/session/auth metadata

#### Controlled preview data

Allowed only after server-side redaction:

- Message preview
- Listing title
- Profile display name

### AI trust & safety rule

AI tools must operate on minimized/redacted inputs. The permissioned sensitive-access endpoint is for explicit human backoffice review and is not available to AI flows by default.

AI must not perform destructive actions.

### Required tests

Trust & safety moderation tests must verify both:

1. Functional behavior works.
2. Sensitive fields are not exposed.

<!-- 2026-06-11-permissioned-sensitive-access-and-audit -->
## 2026-06-11 Update — Permissioned Sensitive Raw Data Access + Audit

The first raw sensitive-access foundation is implemented for backoffice moderation.

Default moderation list/detail responses remain redacted.

Raw access is available only through:

```txt
POST /api/v1/admin/moderation/cases/:caseId/sensitive-access
```

The endpoint requires:

- admin authentication
- dedicated sensitive-access helper
- explicit reason
- allowlisted fields only: `reporter`, `message`
- successful audit event in `events`
- denied audit event in `events` when actor and case context are safely available

This endpoint does not expose conversation participants, full profile data, full listing data, or auth/session metadata.

The current gate is a compatibility rule: admin users are allowed through a dedicated helper until granular permissions exist.

Backoffice case detail now includes a small explicit request panel. It does not auto-fetch sensitive data on load; the admin must open the panel, read the warning, enter a reason, select fields, and submit. Returned raw data is kept in component state only and can be cleared.

Unauthenticated requests and malformed case ids may not create DB audit events because there is no reliable actor/case context.

<!-- 2026-06-11-moderation-triage-filters -->
## 2026-06-11 Update — Moderation Triage Filters

Backoffice moderation now includes safe list triage controls for status, target type, search, sort, and limit.

The list response remains redacted by default. Filters and summary cards operate on safe moderation metadata only and must not expose raw reporter identity, raw message body, conversation participants, emails, tokens, or session metadata.

Search is intentionally limited to safe fields such as case id, report id, target id, target type, status, and report reason/status.

Sensitive access remains separate, explicit, reasoned, and audited through the dedicated sensitive-access endpoint.

Still deferred: queue assignment, SLA tracking, reviewer workload dashboards, and deeper moderation analytics.

<!-- 2026-06-11-moderation-timeline-audit-visibility -->
## 2026-06-11 Update — Moderation Timeline + Audit Visibility

Backoffice moderation case detail now includes a safe timeline.

The timeline combines:

- case/report context
- moderation notes/actions
- status changes
- sensitive-access granted audit events
- sensitive-access denied audit events

The timeline does not expose raw sensitive data. Audit metadata is allowlisted server-side and excludes raw message bodies, reporter emails, phone numbers, tokens, full profile/listing/conversation data, and conversation participants.

Sensitive access remains separate and explicit. The timeline never calls the sensitive-access endpoint.

<!-- 2026-06-12-moderation-enforcement-controls -->
## 2026-06-12 Update — Moderation Enforcement Controls

Backoffice moderation now has the first practical enforcement controls.

Implemented actions:

- hide listing by moving it to `archived`
- restore listing by moving it to `active`
- hide message by setting `messages.deleted_at`
- mark message reviewed as an audited moderation action

Every successful enforcement action requires admin auth, a valid moderation case, a compatible target type, and an explicit reason. It writes a moderation action and an `admin_moderation_enforcement` event so the decision appears in the safe case timeline.

Profile/account enforcement remains future work because profiles/users do not yet have a safe moderation status model.

Listing under-review remains future work because `under_review` is not currently a listing status.
