# Listing Creation Implementation Plan

## Scope

This plan covers the first manual listing creation slice for BabyLoop.

The first implementation should be intentionally small:

- Manual listing creation only
- No auth
- Use a temporary seeded `seller_profile_id` for local development
- No real image upload
- Optional image URL metadata
- No AI-generated listing text
- No moderation workflow yet
- No payment, swap, rental workflow, or notifications

## Listing Creation Flow

1. User opens the web listing creation page.
2. Web fetches product categories from `GET /api/v1/categories`.
3. User fills a minimal listing form.
4. User optionally enters one or more image URLs as metadata.
5. Web submits the form to the API.
6. API validates the request body.
7. API verifies the category exists.
8. API uses the temporary local seller profile id.
9. API inserts the listing as `active`.
10. API inserts optional `listing_images` metadata.
11. API writes a basic `listing_created` event.
12. API returns the created listing id.
13. Web links the user to `/listings/:id`.

## Required Fields

| Field | Type | Notes |
| --- | --- | --- |
| `categoryId` | UUID string | Must reference an existing `product_categories.id`. |
| `title` | string | User-written title. |
| `condition` | enum | One of the existing listing condition values. |
| `listingType` | enum | Start with `sale`; allow existing schema enum values only if UI supports them. |

Recommended temporary seller profile:

```text
10000000-0000-4000-8000-000000000001
```

This is the seeded `Ayse Demir` profile. Replace it with authenticated user ownership later.

## Optional Fields

| Field | Type | Notes |
| --- | --- | --- |
| `description` | string | Nullable in database. Trim empty strings to `null`. |
| `priceAmount` | string | Nullable. Use a decimal string accepted by the database numeric column. |
| `currency` | string | Default to `TRY`. |
| `imageUrls` | string array | Optional metadata only; no upload or image processing. |

## Validation Rules

Use focused request validation in the API. Zod is recommended for this first mutation slice because request bodies are now more complex than route params.

| Field | Rule |
| --- | --- |
| `categoryId` | Required valid UUID. |
| `title` | Required, trimmed, 4-160 characters. |
| `description` | Optional, trimmed, max 2,000 characters. Empty becomes `null`. |
| `priceAmount` | Optional decimal string, non-negative, max 12 total digits with 2 decimals. Empty becomes `null`. |
| `currency` | Optional 3-letter uppercase code; default `TRY`. |
| `condition` | Required enum: `new`, `like_new`, `good`, `fair`, `needs_repair`. |
| `listingType` | Required enum: `sale`, `swap`, `donation`, `rent`. |
| `imageUrls` | Optional array, max 5 URLs, each valid URL and max 1,000 chars. |

API should return `400 INVALID_REQUEST` for validation errors without leaking stack traces.

## API Endpoint Design

Planned endpoint:

```http
POST /api/v1/listings
```

Request body:

```json
{
  "categoryId": "20000000-0000-4000-8000-000000000001",
  "title": "Clean foldable stroller with rain cover",
  "description": "Used for one child, folds easily.",
  "priceAmount": "4500.00",
  "currency": "TRY",
  "listingType": "sale",
  "condition": "good",
  "imageUrls": ["https://example.local/seed/stroller-cover.jpg"]
}
```

Success response:

```json
{
  "ok": true,
  "data": {
    "listing": {
      "id": "created-listing-id"
    }
  }
}
```

Error responses:

| Case | Status | Code |
| --- | --- | --- |
| Invalid body | `400` | `INVALID_REQUEST` |
| Category missing | `400` | `INVALID_CATEGORY` |
| Database unavailable | `503` | `DATABASE_UNAVAILABLE` |
| Unexpected failure | `500` | `INTERNAL_SERVER_ERROR` |

Keep the existing read endpoints unchanged.

## Web Form Design

Planned page:

```text
/sell
```

Form fields:

- Category select
- Title input
- Description textarea
- Price input
- Currency display/input defaulted to `TRY`
- Listing type select
- Condition select
- Optional image URL inputs

Initial UX:

- Server or client fetch categories from the API.
- Client-side form can use a simple React component.
- Submit to `POST /api/v1/listings`.
- Show loading state while submitting.
- Show validation/API error message.
- On success, navigate or link to `/listings/:id`.

No multi-step wizard yet. Keep the form readable and small.

## Image Metadata Handling

First slice:

- Store submitted image URLs in `listing_images.url`.
- Assign `sort_order` based on array order.
- Do not download images.
- Do not validate image content.
- Do not generate thumbnails.
- Do not run AI condition analysis.

This keeps the database path testable without adding object storage.

## Event Logging

Create one event after successful listing insertion:

| Field | Value |
| --- | --- |
| `actor_profile_id` | Temporary seller profile id |
| `event_type` | `listing_created` |
| `entity_type` | `listing` |
| `entity_id` | Created listing id |
| `metadata` | Include safe fields such as `source: "web_manual"`, `categoryId`, `listingType`, and `hasImages`. |

Do not log raw description text or private data in event metadata.

## Future AI Listing Generator Integration Point

Later, listing creation can call AI before publishing or after draft creation:

1. User submits rough listing input.
2. API stores a draft listing.
3. Worker runs AI listing generator.
4. AI suggests title, description, category, attributes, missing details, and safety warnings.
5. User reviews suggestions before publishing.
6. AI inputs/outputs are stored in AI audit logs with prompt versioning.

This first manual creation slice should not create AI task tables or AI task logs yet.

## Future Image Upload Integration Point

Later image handling should add:

- Object storage
- Signed upload URLs
- File size/type validation
- Image metadata extraction
- Thumbnail generation
- Duplicate/copy checks
- AI condition analyzer queue
- Moderation evidence records for risky images

The first slice only accepts image URL metadata to keep the flow verifiable.

## What Will Not Be Implemented Yet

| Delayed item | Reason |
| --- | --- |
| Auth and real seller ownership | Requires auth provider and profile/user mapping. |
| Draft status flow | Keep first mutation simple; add draft/review states with AI and moderation. |
| Real image upload | Requires storage and upload security rules. |
| AI listing generator | Needs prompt versioning and AI task logging first. |
| AI condition analyzer | Requires real images and safety-specific warning flow. |
| Moderation queue | Add after basic listing writes are stable. |
| Edit/delete listing | Requires ownership and audit decisions. |
| Favorites/search/filtering | Separate buyer-side feature slices. |
| Payments/swap/rental state | Larger workflow and compliance surface. |

## Verification Checklist

Implement and verify in this order:

1. Add request validation dependency if needed.
2. Add `POST /api/v1/listings`.
3. Validate invalid body returns `400`.
4. Validate missing category returns `400`.
5. Create a listing with the seeded seller profile id.
6. Insert optional image URL metadata.
7. Insert a `listing_created` event.
8. Confirm `GET /api/v1/listings` includes the new listing.
9. Confirm `GET /api/v1/listings/:id` returns the new listing detail.
10. Add `/sell` web form.
11. Submit form from web and navigate/link to detail.
12. Run `pnpm typecheck`.
13. Run `pnpm build`.
14. Confirm no auth, AI, real image upload, moderation, payment, or notification code was added.
