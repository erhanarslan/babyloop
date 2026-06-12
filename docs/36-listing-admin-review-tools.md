<!-- 2026-06-12-listing-admin-review-tools -->
# Listing Admin Review Tools

BabyLoop now has a first MVP backoffice listing review area for marketplace operations.

This is intentionally separate from moderation case enforcement. It gives admins a privacy-safe view of listings, related cases, and listing-scoped archive/restore actions without exposing raw sensitive data.

## API Endpoints

```txt
GET /api/v1/admin/listings
GET /api/v1/admin/listings/:listingId
POST /api/v1/admin/listings/:listingId/actions
POST /api/v1/admin/listings/:listingId/images/:imageId/actions
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

Image review actions:

- `approve` sets `listing_images.review_status` to `approved`
- `reject` sets `listing_images.review_status` to `rejected`

## Privacy Boundaries

Admin listing DTOs may include:

- listing public/safe fields
- category summary
- price/currency
- status
- image count and safe listing image URLs
- image review status, reviewed timestamp, and reviewer profile id for admin review
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

Image review actions write `events.eventType = admin_listing_image_review_applied` with safe metadata: `listingId`, `imageId`, `action`, `previousReviewStatus`, `nextReviewStatus`, `reasonLength`, and `result`.

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
- image review controls for approved/rejected status
- related moderation case summaries
- archive/restore action form with required reason
- listing-scoped activity/audit trail

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
- pending image queue and automated image moderation
- profile enforcement, because profiles/users do not yet have a safe account status model
- assignment and SLA workflows
- advanced dashboard metrics/charts
- appeals and export flows
- image moderation automation

## Manual Validation Checklist

- Login to backoffice as an admin.
- Open `/listings`.
- Filter by status.
- Search by listing id/title/category/seller profile id.
- Open a listing detail.
- Confirm seller email/phone are not displayed.
- Reject an image with a reason and confirm it is hidden publicly.
- Approve the image again and confirm it appears publicly.
- Confirm related moderation cases show safe summaries only.
- Archive a listing with a reason.
- Confirm an audit event id/history appears after refresh.
- Restore the listing with a reason.
- Confirm public sensitive-access UI is not involved.
- Confirm no raw reporter identity or raw message body appears.
