# Listing Image Upload and Safety

## Purpose

BabyLoop now supports real listing image upload for local development and tests. This document records the storage architecture, API contract, and safety rules.

## Storage Architecture

Local development storage:

```text
var/uploads/listings/<listingId>/<random-file-name>.<ext>
```

`var/uploads/` is ignored by git.

PostgreSQL stores only image metadata:

- `listing_images.id`
- `listing_images.listing_id`
- `listing_images.url`
- `listing_images.sort_order`
- timestamps

The database does not store raw image bytes or base64.

Public image URLs are API-relative:

```text
/api/v1/uploads/listings/<listingId>/<random-file-name>.png
```

The web app resolves these paths against the configured API base URL.

## API Endpoints

Upload:

```http
POST /api/v1/listings/:listingId/images
```

- auth required
- owner only
- multipart/form-data
- field name: `image`
- returns image metadata

Delete:

```http
DELETE /api/v1/listings/:listingId/images/:imageId
```

- auth required
- owner only
- deletes DB row
- deletes local file best-effort

Reorder:

```http
PATCH /api/v1/listings/:listingId/images/reorder
```

Body:

```json
{
  "imageIds": ["..."]
}
```

- auth required
- owner only
- `imageIds` must contain all current listing images

Serve:

```http
GET /api/v1/uploads/listings/:listingId/:filename
```

- public
- serves only safe image files under the configured upload root
- sets `X-Content-Type-Options: nosniff`
- returns `404` for missing or invalid paths

## Safety Rules

Allowed:

- JPEG
- PNG
- WEBP

Rejected:

- SVG
- GIF
- HTML
- XML
- PDF
- JavaScript
- unknown binary
- declared MIME mismatch
- file extension mismatch
- magic-byte mismatch
- files over 5MB
- more than 5 images per listing
- path traversal attempts

The server never trusts original filenames as filesystem paths. Stored filenames use `crypto.randomUUID()`.

## Error Codes

- `UNAUTHORIZED`
- `FORBIDDEN`
- `NOT_FOUND`
- `INVALID_IMAGE`
- `IMAGE_TOO_LARGE`
- `TOO_MANY_IMAGES`
- `INVALID_REQUEST`

Unexpected storage failures return a generic server error and do not expose filesystem paths.

## Cleanup Rules

- If file storage succeeds but DB insert fails, the stored file is deleted best-effort.
- When an image is deleted through the API, the DB row is removed and the local file is deleted best-effort.
- Uploaded test files use test-specific temporary directories.

## R2/S3 Storage Status

Listing image upload now uses an image storage abstraction. `IMAGE_STORAGE_DRIVER=local` keeps the local development route, while `IMAGE_STORAGE_DRIVER=s3` stores listing images in an S3/R2-compatible bucket and returns stable public media URLs.

Required production boundaries:

- keep `listing_images.url` as the public API/stable media URL
- preserve safety validation before object write
- use HTTPS `IMAGE_STORAGE_PUBLIC_BASE_URL`
- keep storage credentials server-side only
- keep image normalization enabled before broad production use
- keep backoffice storage preview credential-safe
- add duplicate-image content hash detection before broad production use

## Manual QA Checklist

- Login as a seller.
- Create a listing with a valid PNG/JPEG/WEBP image.
- Confirm preview appears before submit.
- Confirm uploaded image appears on listing detail.
- Confirm uploaded image appears as my-listings thumbnail.
- Try SVG and confirm rejection.
- Try HTML disguised as PNG and confirm rejection.
- Try an oversized file and confirm rejection.
- Login as another user and confirm upload/delete is forbidden.
- Delete own image and confirm listing detail updates.
- Check mobile width for preview wrapping.

## Security Notes

- No SVG support.
- No raw user filename trust.
- No raw image bytes/base64 in PostgreSQL.
- No arbitrary filesystem serving.
- Magic bytes are checked in addition to MIME and extension.
- API image responses set `nosniff`.
- EXIF stripping, resize/transform processing, CDN/cache policy, upload rate limits, and image moderation are intentionally deferred.

## Duplicate Image Detection

Listing images store a server-side SHA-256 `content_hash` of the normalized image bytes. The API rejects uploading the same image content twice to the same listing with `DUPLICATE_LISTING_IMAGE`.

Current product rule:

- duplicate image content within the same listing is rejected,
- the same image content across different listings is allowed for now,
- cross-listing duplicates should be treated later as a fraud/risk signal rather than a hard block,
- content hashes are internal metadata and must not be exposed in public, owner, or admin DTOs.

## S3/R2 Contract Regression

S3/R2 store/delete/resolve contract is covered by `apps/api/test/image-storage-s3-contract.test.ts`. The regression verifies that public media URLs map to bucket object keys, delete ignores attacker-controlled public base URLs, unsafe filenames are rejected before object reads, and returned storage metadata does not expose credentials.
