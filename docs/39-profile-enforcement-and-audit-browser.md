<!-- 2026-06-12-profile-enforcement-and-audit-browser -->
# Profile Enforcement And Audit Browser

## Implemented Scope

Backoffice Trust & Safety now has a minimal profile safety status model and a safe audit browser.

Profile safety statuses live on `profiles`:

- `active`: normal marketplace behavior
- `restricted`: cannot create new listings or send new messages
- `suspended`: cannot create new listings or send new messages; public listing list/detail responses hide listings owned by suspended sellers

The profile row stores status, update timestamp, a short internal reason code, and the profile id of the admin actor when available. Long-form admin reasons are not stored on the profile row.

## Moderation Enforcement

Profile-target moderation cases support:

- `profile_warn`: audit-only action, no persistent status change
- `profile_restrict`: sets `safety_status = restricted`
- `profile_suspend`: sets `safety_status = suspended`
- `profile_restore`: sets `safety_status = active`

No-op transitions are rejected and must not write audit events. Profile actions are valid only for profile-target cases. Listing/message actions remain valid only for their own target types.

Successful profile enforcement writes moderation action history plus an `admin_profile_enforcement_applied` event. Audit metadata is safe-only: target ids, action, previous/next safety status, reason length, and result.

## Product Effects

Restricted and suspended profiles cannot create new listings or send messages. Suspended seller listings are hidden from public listing list/detail queries. Admin listing review can still inspect affected listings through admin endpoints.

Public errors use generic marketplace restriction messages and do not expose private enforcement details.

## Audit Browser

Backoffice exposes:

```txt
GET /api/v1/admin/audit/events
```

The response includes audit event id, event type, entity type/id, actor profile id, timestamp, and allowlisted metadata only.

Allowed metadata includes ids, action names, previous/next status fields, requested/granted/denied field names, reason length, and safe denial/result codes.

The audit browser must not return raw metadata wholesale and must not include:

- reporter email
- user email
- seller phone
- raw message body
- raw reason text
- profile/listing/message objects
- tokens, cookies, password hashes, or auth/session internals

The backoffice `/audit` page renders safe metadata chips and safe links to related cases/listings when ids are available. It does not call sensitive-access endpoints.

## Dashboard

The dashboard summary remains aggregate-only and now includes restricted/suspended profile counts, profile enforcement actions in the last 7 days, and total audit events in the last 7 days.

## Deferred

- appeals
- assignment/SLA
- granular RBAC
- full CSRF token enforcement
- AI moderation
- duplicate image detection
- exports
- full user directory/profile admin detail
