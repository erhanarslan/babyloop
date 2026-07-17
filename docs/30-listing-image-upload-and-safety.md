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

AI listing draft:

```http
POST /api/v1/listings/ai-draft-suggestions
```

- auth required
- multipart/form-data
- image field name: `images` or `image`
- accepts at most 5 JPEG/PNG/WEBP images plus safe text fields such as title, description, categoryId, listingType, condition, priceAmount, city, and locale
- returns a suggestion object only; it never creates, updates, submits, or publishes a listing
- unavailable providers return a controlled 503 so manual listing creation can continue

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
- keep duplicate-image content hash detection enabled before broad production use

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
- No raw image base64, raw provider output, prompt, provider/model metadata, API key, token, cookie, authorization header, e-mail, or phone value is returned to mobile AI listing draft UI.
- No arbitrary filesystem serving.
- Magic bytes are checked in addition to MIME and extension.
- API image responses set `nosniff`.
- Dedicated per-profile/per-IP upload frequency quotas and broader image moderation remain future work.

## Mobile AI draft safety

The mobile sell screen can request a visual listing draft from the existing listings endpoint. The result is advisory and non-blocking:

- the user must tap `Boş alanlara uygula` before any suggestion is copied into the form;
- only empty title, description, and category fields are filled;
- user-entered title, description, category, listing type, condition, and price are preserved;
- price suggestions are displayed as an information range and are not auto-applied;
- condition suggestions are displayed as information and are not auto-applied;
- warnings, missing details, and image feedback remain visible before the user submits;
- the normal manual listing flow continues even if AI is unavailable.

Provider prompts must not invent unreadable brand/model/measurement data, unseen accessories, accident/repair/history claims, safety certifications, or safety guarantees. For car seats, cribs, bassinets, bouncers, carriers, and similar safety-sensitive products, AI copy must not claim `güvenli`, `kazasız`, `sertifikalı`, `sorunsuz`, or guaranteed suitability unless the seller explicitly provides verifiable evidence outside the AI inference.

## Duplicate Image Detection

Listing images store a server-side SHA-256 `content_hash` of the normalized image bytes. The API rejects uploading the same image content twice to the same listing with `DUPLICATE_LISTING_IMAGE`.

Current product rule:

- duplicate image content within the same listing is rejected,
- the same image content across different listings is allowed for now,
- cross-listing duplicates should be treated later as a fraud/risk signal rather than a hard block,
- content hashes are internal metadata and must not be exposed in public, owner, or admin DTOs.

## S3/R2 Contract Regression

S3/R2 store/delete/resolve contract is covered by `apps/api/test/image-storage-s3-contract.test.ts`. The regression verifies that public media URLs map to bucket object keys, delete ignores attacker-controlled public base URLs, unsafe filenames are rejected before object reads, and returned storage metadata does not expose credentials.

## MIME, magic-byte, and metadata boundary

Listing image upload validation rejects unsupported or mismatched files by comparing the filename extension, declared MIME type, and detected image magic bytes before storage. Supported content types remain JPEG, PNG, and WEBP.

The storage path normalizes images through Sharp before local/S3/R2 writes. Re-encoded listing images must not preserve EXIF or other original metadata. The image storage security guard checks for the MIME/magic-byte boundary and rejects accidental metadata-preserving optimization changes.

## Upload abuse and public media cache boundary

Current upload abuse protection is intentionally layered:

- global API rate limiting is registered through `@fastify/rate-limit`;
- multipart parsing is bounded by `MAX_LISTING_IMAGE_BYTES` and `MAX_LISTING_IMAGES`;
- dedicated listing image upload keeps a per-file `fileSize` limit;
- per-listing image count is capped before storage;
- MIME, extension, magic-byte, SVG/HTML, oversized, and duplicate-content checks run before DB exposure;
- local uploaded media responses set `Cache-Control: public, max-age=31536000, immutable`;
- S3/R2 storage requires an explicit `IMAGE_STORAGE_PUBLIC_BASE_URL` and validates public URL boundaries;
- optional S3/R2 proxy memory cache is capped by `IMAGE_PROXY_MEMORY_CACHE_MAX_BYTES` and `IMAGE_PROXY_MEMORY_CACHE_MAX_ITEM_BYTES`.

Dedicated per-profile/per-IP upload frequency quotas remain future work. They should be implemented before scale with a shared backend such as Redis so multi-instance API deployments enforce the same abuse window. The current beta boundary must still keep size/count limits, safe 400/413/429 errors, and storage credential secrecy intact.

## Listing image authenticity provider boundary

Listing image authenticity is a provider-backed trust signal for uploaded listing photos. The current boundary supports:

- local/test mock execution for deterministic tests;
- `unavailable` mode for safe fallback when real enforcement is not configured;
- Gemini-backed enforcement through `LISTING_IMAGE_AUTHENTICITY_PROVIDER=gemini`;
- server-side API key use through `GEMINI_API_KEY` or `GOOGLE_API_KEY`;
- decision mapping to `allow`, `needs_review`, or `reject`;
- safe upload errors for rejected and unavailable decisions;
- AI run/audit metadata for provider, model, prompt version, confidence, decision, reasons, and safe flags;
- backoffice visibility through AI Ops and listing image review panels.

The mock provider is local/test only and must not be considered production image authenticity enforcement. The service does not store raw image bytes, base64, raw prompts, raw provider output, API keys, tokens, cookies, or password hashes in listing image authenticity audit metadata. Broader policy tuning, cross-listing fraud scoring, appeal workflows, and perceptual duplicate detection remain future work.

## Cross-listing duplicate image boundary

BabyLoop currently rejects duplicate image content only within the same listing. This is intentional.

A global hard block on the same `content_hash` across different listings is risky in the MVP because the same seller may relist the same item, migrate a listing, recover from an archived listing, or upload a legitimate replacement listing. Cross-listing duplicate image use should become a fraud/risk signal rather than an automatic reject.

Future cross-listing duplicate/fraud scoring must include at least:

- seller context and account age;
- listing status/history and prior archive/sold state;
- time window between uploads;
- whether the image is identical by normalized hash or only visually similar by perceptual hash/provider signal;
- category and high-risk product context;
- admin review queue/audit metadata;
- appeal or manual override boundaries.

Content hashes are internal storage/trust metadata. They must not be exposed in public, owner, or admin DTOs. The current database uniqueness boundary must remain `(listing_id, content_hash)`, while the standalone `content_hash` index remains available for future risk-signal queries.

## Image upload/review storage boundary

Run pnpm security:image-upload-review-storage before claiming the upload/review chain complete.

The image upload/review storage boundary checks that seller upload responses, admin review responses, public listing responses, admin listing detail, and authenticity audit metadata do not expose objectKey, filePath, contentHash, raw provider output, raw upload body, base64 image data, credentials, tokens, cookies, storageDriver, uploadRoot, or local absolute paths.

This does not enable S3/R2 rollout, signed upload, bucket mutation, CDN purge, or queue workers.

Image upload/review storage boundary does not expose objectKey, does not expose filePath, and does not expose contentHash in public or admin API responses.
