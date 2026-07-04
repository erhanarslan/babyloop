<!-- 2026-06-12-marketplace-review-operations -->
# Marketplace Review Operations

BabyLoop now has a first marketplace operations layer in backoffice.

This extends listing admin review without changing the public app and without using the moderation sensitive-access endpoint.

## Implemented

### Image Review Status

`listing_images` now has:

- `review_status`: `approved | rejected`
- `reviewed_at`
- `reviewed_by_profile_id`

Existing and newly uploaded images default to `approved`, so current public listing behavior is preserved until an admin explicitly rejects an image.

Rejected images are hidden from public listing list/detail responses. Admin listing detail still shows all images, including rejected images, with safe review metadata.

Seller listing URL updates preserve matching existing image rows and review state. This prevents a same-URL seller update from silently recreating a rejected image as approved. Deleting a rejected image and uploading a visually identical new file is not blocked in this MVP; perceptual duplicate detection remains deferred.

### Image Review Endpoint

```txt
POST /api/v1/admin/listings/:listingId/images/:imageId/actions
```

Request:

```json
{
  "action": "reject",
  "reason": "Required review reason"
}
```

Supported actions:

- `approve`
- `reject`

The endpoint requires admin auth, matching `listingId`/`imageId`, and a useful reason. It does not call sensitive-access and does not perform listing archive/restore.

No-op transitions are rejected server-side:

- approved image + `approve` returns `400`
- rejected image + `reject` returns `400`
- rejected no-op transitions do not write `admin_listing_image_review_applied`

### Image Review Audit

Image review writes:

```txt
events.eventType = admin_listing_image_review_applied
events.entityType = listing
events.entityId = listingId
```

Safe metadata:

- `listingId`
- `imageId`
- `action`
- `previousReviewStatus`
- `nextReviewStatus`
- `reasonLength`
- `result`

Raw reason text, seller contact data, reporter identity, message body, tokens, raw profile/user objects, and image binary data are not stored in audit metadata.

### Listing Activity

Admin listing detail shows a safe activity/audit section with:

- listing actions (`admin_listing_action_applied`)
- image review actions (`admin_listing_image_review_applied`)
- related listing moderation enforcement events when safely connected through moderation cases

Activity metadata is allowlisted and must not expose raw sensitive data.

### Dashboard MVP

```txt
GET /api/v1/admin/dashboard/summary
```

The dashboard returns aggregate counts only:

- listing totals by status
- listing created/updated counts for the last 7 days
- image review totals
- moderation case totals
- sensitive-access grant/deny counts for the last 7 days
- listing/image action counts for the last 7 days

The dashboard does not return seller identity, reporter identity, message content, raw event metadata, profile/user objects, tokens, or auth/session data.

## Backoffice UI

- `/` now shows the marketplace review dashboard.
- `/listings/[listingId]` now includes image review controls.
- Image review controls require a reason and explicit submit.
- Rejected images remain visible in backoffice listing detail and hidden from public listing responses.
- Listing activity remains safe metadata only.

## Privacy Boundaries

Marketplace review operations must not expose:

- seller email
- seller phone
- raw user/profile objects
- reporter identity
- raw message body
- conversation participants
- tokens, refresh tokens, cookies, or password hashes
- raw admin reasons in public or default admin DTOs

Sensitive-access remains separate and is not used by listing image review, listing activity, or dashboard summary.

Backoffice marketplace review tools rely on the dedicated backoffice auth flow. Admin access tokens must be transported through httpOnly cookies and must not be stored in browser `localStorage`, `sessionStorage`, URLs, or console logs.

## Deferred

- pending image queue
- automated AI image scanning
- image transformations/thumbnail moderation workflow
- profile enforcement is now handled through profile-target moderation cases; full user directory and appeals remain deferred
- appeals
- exports
- assignment/SLA
- granular RBAC
- advanced analytics and charts

## Manual Validation Checklist

- Reject a listing image as admin and confirm it disappears from public listing detail/list summaries.
- Confirm admin listing detail still shows the rejected image with `reviewStatus = rejected`.
- Approve the image again and confirm it appears publicly.
- Confirm image review writes `admin_listing_image_review_applied`.
- Confirm listing activity shows listing and image review actions with safe metadata.
- Confirm dashboard summary loads for admin and is forbidden for non-admin.
- Confirm dashboard response contains aggregate counts only.
- Confirm no seller email/phone, reporter identity, raw message body, tokens, or raw event metadata appears.

## Image storage driver boundary

Listing image review continues to operate on `listing_images.url`. Local image URLs keep using `/api/v1/uploads/listings/...`; S3/R2 image URLs are absolute public URLs. Admin review actions must not expose object storage credentials or raw image binary data.

## Storage ops visibility

Backoffice storage ops preview shows whether listing image storage is running in local or S3/R2-compatible mode. It is an operational preview only and must not be used to expose credentials or mutate stored images.

## Automated image review regression guard

Backoffice listing image review is covered by a dedicated E2E smoke and a security guard:

- `apps/backoffice/e2e/listing-image-review.smoke.spec.ts`
- `scripts/check-backoffice-image-review-security.mjs`

The guard locks the backoffice/API contract for approve/reject review actions, useful reasons, safe error rendering, audit visibility, storage credential boundaries, and the separation from sensitive-access. Image review must continue to operate on safe listing image metadata only; it must not expose raw image bytes, object storage credentials, raw admin reasons, seller contact data, reporter identity, raw message bodies, tokens, cookies, password hashes, or raw profile/user objects.

Focused validation:

```bash
pnpm security:backoffice-image-review
BACKOFFICE_E2E_BASE_URL=http://localhost:3001 pnpm --filter @babyloop/backoffice exec playwright test e2e/listing-image-review.smoke.spec.ts --reporter=list
```
