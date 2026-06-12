# AI Listing Suggestion Web Plan

## Scope

This plan covers the first web integration for the existing mock listing suggestion API.

This document records the first public web listing suggestion slice. That slice intentionally stayed mock-only and text-field based. Backoffice moderation summaries now have a separate real-provider foundation; do not confuse that internal Trust & Safety AI flow with the public listing assistant.

Do not add public real-provider calls, image analysis, valuation, market research, moderation, or automatic listing mutation in this slice. These now belong to later listing-assistant phases documented in `docs/41-current-task-map-and-roadmap.md`.

## Target Page

Use the existing manual listing page:

```text
/sell
```

The manual create listing flow must remain usable without AI.

## User Flow

1. Seller enters draft listing fields.
2. Seller clicks an optional suggestion button.
3. Web sends draft fields to `POST /api/v1/ai/listing-suggestions`.
4. API returns mock suggestions.
5. Web displays suggested title, description, tags, missing questions, confidence, provider, and prompt version.
6. Seller can manually copy or use the suggestion later.

First slice should not auto-overwrite form fields.

## Request Mapping

| Web form field | API field |
| --- | --- |
| `title` | `title` |
| `description` | `description` |
| selected category display name | `categoryName` |
| `condition` | `condition` |

Do not send seller profile id, listing id, price, image URLs, or private user data.

## UI Behavior

- Add one secondary action near the form actions.
- Show loading state while suggestion request is running.
- Show safe error text if the suggestion endpoint fails.
- Show result in a small non-blocking panel.
- Keep the existing `Create listing` button behavior unchanged.

## Validation and Safety

- Client should not trust AI output as final listing content.
- API validation remains the source of truth.
- Empty form should not call the suggestion endpoint.
- Low confidence should show missing information questions instead of strong claims.
- AI must not imply safety certainty for baby products.

## Current Status — 2026-06-12

Implemented:

- `/sell` can request a mock listing suggestion from text fields.
- The suggestion panel is non-blocking and does not auto-submit or mutate server data.
- Listing creation remains manual and usable without AI.

Deferred public listing assistant work:

- image-based brand/model/category inference
- condition estimation from photos
- price range estimation
- comparable/market research
- accept/apply buttons with explicit user control
- real provider for public listing assistance
- production safety/cost/rate controls

## What Is Intentionally Delayed

- accept/apply buttons that mutate form fields
- persisted AI task logs
- real model provider
- prompt management UI
- price estimation
- RAG assistant
- moderation
- recommendation

## Verification Checklist

1. Start API with `DATABASE_URL`.
2. Start web with `BABYLOOP_API_BASE_URL`.
3. Open `/sell`.
4. Enter partial listing fields.
5. Request mock suggestion.
6. Confirm suggestion panel renders.
7. Confirm invalid/empty input does not break the form.
8. Confirm `Create listing` still creates and redirects to detail page.
9. Run `pnpm --filter @babyloop/web typecheck`.
10. Run `pnpm --filter @babyloop/web build`.
