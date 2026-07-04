# Listing Lifecycle and Platform Foundation

## Listing Lifecycle

BabyLoop listings are lifecycle objects, not hard-deleted marketplace records.

Supported seller-facing statuses:

- `active`: visible in default browse and public detail; buyers can start conversations.
- `reserved`: visible in default browse and public detail with a reserved status; buyers can still start conversations.
- `sold`: hidden from default browse and public detail; new conversations are blocked.
- `archived`: hidden from default browse and public detail; new conversations are blocked.

The database enum still contains `draft` for compatibility with the original schema, but listing creation currently publishes directly as `active`. Draft workflow remains deferred.

## Status Transitions

Allowed transitions:

- `active` -> `reserved`, `sold`, `archived`
- `reserved` -> `active`, `sold`, `archived`
- `archived` -> `active`
- `sold` -> `archived`

Sold listings are not directly reactivated. If that product rule changes later, it should be implemented deliberately with tests and seller-facing copy.

## API Endpoints

Seller-owned lifecycle endpoints:

- `PATCH /api/v1/listings/:id`
  - Updates editable fields for the authenticated owner.
  - Supported fields include title, description, category, price, currency, listing type, condition, and image URLs.
- `PATCH /api/v1/listings/:id/status`
  - Updates the authenticated owner's lifecycle status.
  - Body: `{ "status": "active" | "reserved" | "sold" | "archived" }`
- `POST /api/v1/listings/:id/images`
  - Uploads one validated listing image for the authenticated owner.
  - Uses multipart/form-data field `image`.
- `DELETE /api/v1/listings/:id/images/:imageId`
  - Deletes one listing image for the authenticated owner.
- `PATCH /api/v1/listings/:id/images/reorder`
  - Reorders all current listing images for the authenticated owner.

Authorization:

- logged-out users receive `401`
- non-owners receive `403`
- missing listings receive `404`
- invalid status values receive `INVALID_LISTING_STATUS`
- invalid transitions receive `INVALID_STATUS_TRANSITION`

## Public Browse and Detail

Default public browse returns `active` and `reserved` listings only.

Public detail returns `active` and `reserved` listings only. Sold and archived listings return the existing controlled unavailable/not-found behavior instead of exposing a public read-only detail page.

## Messaging

Starting a new conversation is allowed only for `active` and `reserved` listings.

Existing conversations and messages remain readable for participants after a listing becomes sold or archived. Listing status changes do not delete conversation rows, listing context rows, or message rows.

## Frontend Wiring

`/my-listings` shows each listing status and provides real actions backed by API calls:

- edit title/price
- upload/delete listing image
- mark reserved
- mark sold
- archive
- reactivate reserved or archived listings

Sold listings can be archived, but not reactivated directly.

## Local Docker Compose

`docker-compose.dev.yml` runs local dependencies only:

- PostgreSQL 16 for `babyloop_dev`
- Redis 7 for future queues, Socket.IO adapter work, rate-limit storage, and notification delivery expansion

Web and API still run with pnpm on the host machine.

Start local dependencies:

```bash
docker compose -f docker-compose.dev.yml up -d
```

Stop local dependencies:

```bash
docker compose -f docker-compose.dev.yml down
```

Reset local dependency volumes:

```bash
docker compose -f docker-compose.dev.yml down -v
```

Run migrations:

```bash
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/babyloop_dev pnpm --filter @babyloop/database db:migrate
```

Run API tests against a disposable test database:

```bash
TEST_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/babyloop_test pnpm --filter @babyloop/api test
```

## CI Foundation

`.github/workflows/ci.yml` runs on pull requests and pushes to `main` or `master`.

The workflow:

- installs Node from `.node-version`
- activates pnpm `10.33.0`
- installs with a frozen lockfile
- runs shared/API/web/root typechecks
- runs shared unit tests
- runs API integration tests with a PostgreSQL service
- runs shared/API/web/root builds

No deployment, Docker image push, cloud infrastructure, or production release workflow is included.

## Listing Image Storage

Listing image upload is implemented as a local development/test foundation:

- files are stored under `var/uploads/listings/<listingId>/`
- `var/uploads/` is gitignored
- database rows store metadata and API-relative URLs only
- JPEG, PNG, and WEBP are allowed
- SVG, GIF, HTML, XML, PDF, JS, unknown binary, oversized files, and MIME/extension/magic-byte mismatches are rejected
- max size is 5MB per image
- max count is 5 images per listing
- image serving uses `/api/v1/uploads/listings/:listingId/:filename`
- production object storage, transform/metadata stripping, CDN/cache public media boundaries, and upload size/count guards are implemented; dedicated upload frequency quotas and broader image moderation remain future work

S3/R2-compatible object storage preserves the API contract by keeping `listing_images.url` as the stable public media URL.

## Deferred Work

Intentionally deferred:

- S3/R2/image hardening: listing-scoped duplicate-image content hash detection, upload/storage boundary guards, and listing image authenticity provider guards are implemented; remaining work is dedicated upload frequency/quota controls, fraud scoring for cross-listing duplicates, broader policy tuning, appeal workflows, and perceptual duplicate detection
- Redis-backed queues and Socket.IO adapter
- saved searches
- admin moderation
- payment/secure checkout
- real AI/RAG work
- mobile app
