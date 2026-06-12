<!-- 2026-06-12-listing-admin-review-tools -->
# Listing Admin Review Tools

BabyLoop now has a first MVP backoffice listing review area for marketplace operations.

This is intentionally separate from moderation case enforcement. It gives admins a privacy-safe view of listings, related cases, and listing-scoped archive/restore actions without exposing raw sensitive data.

## API Endpoints

```txt
GET /api/v1/admin/listings
GET /api/v1/admin/listings/:listingId
POST /api/v1/admin/listings/:listingId/actions
```

List filters:

- `status`
- `q`
- `categoryId`
- `sort`
- `limit`

Listing actions:

```json
{
  "action": "archive",
  "reason": "Required review reason"
}
```

Supported actions:

- `archive` sets `listings.status` to `archived`
- `restore` sets `listings.status` to `active`

## Privacy Boundaries

Admin listing DTOs may include:

- listing public/safe fields
- category summary
- price/currency
- status
- image count and safe listing image URLs
- seller profile id, display name, city, and profile creation timestamp
- related moderation case counts and safe case summaries

Admin listing DTOs must not include:

- seller email
- seller phone
- raw user object
- raw profile object
- reporter identity
- raw message body
- conversation participants
- tokens or auth/session metadata

Search is limited to safe listing and operational fields such as listing id, title, public description, category id/name, seller profile id, and status. It must not search private emails, phones, message bodies, reporter identity, or conversation content.

## Audit Behavior

Listing-scoped admin actions write:

```txt
events.eventType = admin_listing_action_applied
events.entityType = listing
events.entityId = listingId
```

Safe metadata includes:

- `listingId`
- `action`
- `previousStatus`
- `nextStatus`
- `reasonLength`

The audit event intentionally does not store seller contact data, reporter identity, message body, tokens, or raw profile/user objects. The first version stores `reasonLength` rather than the reason text for listing actions.

## Backoffice UI

New routes:

```txt
/listings
/listings/[listingId]
```

The list page supports status/search/sort/limit controls and displays safe seller summaries, image count/preview, and moderation case counts.

The detail page shows:

- listing summary
- status badge
- privacy-safe seller summary
- read-only image review foundation
- related moderation case summaries
- archive/restore action form with required reason
- listing-scoped audit trail

The listing review UI does not call the sensitive-access endpoint and does not store sensitive data in localStorage, sessionStorage, cookies, URL params, or console logs.

## Boundary With Moderation Enforcement

Case-scoped enforcement remains:

```txt
POST /api/v1/admin/moderation/cases/:caseId/enforcement
```

Listing review actions are listing-scoped marketplace operations:

```txt
POST /api/v1/admin/listings/:listingId/actions
```

They currently share the same underlying safe listing statuses (`active` and `archived`) but serve different workflows.

## Deferred

- listing `under_review` status, because the current listing status enum does not support it
- image approve/reject status, because listing images do not yet have moderation status fields
- profile enforcement, because profiles/users do not yet have a safe account status model
- assignment and SLA workflows
- dashboard metrics
- appeals and export flows
- image moderation automation

## Manual Validation Checklist

- Login to backoffice as an admin.
- Open `/listings`.
- Filter by status.
- Search by listing id/title/category/seller profile id.
- Open a listing detail.
- Confirm seller email/phone are not displayed.
- Confirm image review is read-only.
- Confirm related moderation cases show safe summaries only.
- Archive a listing with a reason.
- Confirm an audit event id/history appears after refresh.
- Restore the listing with a reason.
- Confirm public sensitive-access UI is not involved.
- Confirm no raw reporter identity or raw message body appears.
