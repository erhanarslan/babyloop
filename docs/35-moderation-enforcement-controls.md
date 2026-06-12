<!-- 2026-06-12-moderation-enforcement-controls -->
# Moderation Enforcement Controls

BabyLoop now has a first backoffice enforcement foundation for supported moderation case targets.

This is intentionally narrow. It is not a full account suspension, admin dashboard, SLA, or automated AI enforcement system.

## Endpoint

```txt
POST /api/v1/admin/moderation/cases/:caseId/enforcement
```

Required controls:

- admin authentication
- valid moderation case id
- allowlisted action
- action compatible with the case target type
- explicit reason, minimum 10 characters
- moderation action row
- `admin_moderation_enforcement` audit event

## Implemented Actions

```txt
listing_hide
listing_restore
message_hide
message_mark_reviewed
```

Listing behavior:

- `listing_hide` sets `listings.status` to `archived`
- `listing_restore` sets `listings.status` to `active`

Message behavior:

- `message_hide` sets `messages.deleted_at`
- normal messaging reads show hidden messages as plaintext moderation placeholder text
- latest-message preview ignores hidden messages
- `message_mark_reviewed` records the moderation decision without changing message content because messages do not have a reviewed status column

## Audit and Timeline

Every successful action writes:

- `moderation_actions`
- `events.eventType = admin_moderation_enforcement`

Safe audit metadata:

```txt
enforcementAction
targetType
targetId
resultingStatus
```

Case detail timeline can show the enforcement event and action using safe labels and metadata only.

## Privacy Rules

Enforcement responses and timeline metadata must not include:

- raw message body
- reporter email
- user email
- phone numbers
- tokens or refresh tokens
- auth/session metadata
- full profile data
- full listing data
- full conversation data
- conversation participants

Sensitive access remains a separate endpoint and is not called by enforcement UI.

AI must not auto-enforce or call enforcement endpoints by default.

## Deferred

- profile/account enforcement
- account suspension or user status model
- listing `under_review` state
- reversible message unhide workflow
- assignment, SLA, reviewer queues, dashboards
- appeals and enforcement notifications

## Related Listing Review Tools

Marketplace listing review now also has listing-scoped admin tools:

```txt
GET /api/v1/admin/listings
GET /api/v1/admin/listings/:listingId
POST /api/v1/admin/listings/:listingId/actions
```

Those actions currently support `archive` and `restore` for direct listing operations. They are audited with `admin_listing_action_applied` and remain separate from case-scoped enforcement. They do not call sensitive-access and must not expose seller contact data, reporter identity, or raw message bodies.
