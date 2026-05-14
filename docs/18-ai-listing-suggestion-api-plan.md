# AI Listing Suggestion API Plan

## Scope

This plan covers the first API integration for the existing mock listing suggestion provider in `packages/ai-core`.

Do not add real AI providers, database logging, web UI changes, auth, moderation, or pricing in this slice.

## Endpoint

Planned endpoint:

```http
POST /api/v1/ai/listing-suggestions
```

The endpoint should be optional assistance for sellers. It must not create, update, publish, or block listings.

## Request Body

Use the same minimal fields supported by `@babyloop/ai-core`:

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `title` | string | No | Draft seller title. |
| `description` | string | No | Draft seller description. |
| `categoryName` | string | No | Category display name, not category id. |
| `condition` | string | No | Draft condition label/value. |

Validation:

- trim strings
- max 160 chars for `title`
- max 2,000 chars for `description`
- max 120 chars for `categoryName`
- max 80 chars for `condition`
- reject unknown fields
- require at least one meaningful input field

## Response Body

Return the `ListingSuggestionOutput` shape:

```json
{
  "ok": true,
  "data": {
    "suggestion": {
      "suggestedTitle": "Clean stroller",
      "suggestedDescription": "A stroller in good condition...",
      "suggestedTags": ["strollers", "good", "manual-review"],
      "missingInfoQuestions": ["What is included, missing, worn, or damaged?"],
      "confidenceScore": 0.75,
      "providerName": "mock-listing-suggestion",
      "promptVersion": "listing_suggestion.mock.v1"
    }
  }
}
```

## API Integration

- Add `@babyloop/ai-core` as an API workspace dependency.
- Create a small route file under `apps/api/src/routes`.
- Register it under the existing `API_PREFIX`.
- Use Zod in the API route for request validation.
- Use `suggestListing` from `@babyloop/ai-core`.
- Keep error responses consistent with existing `ApiResponse`.

## Fallback Behavior

For the mock provider, failures should be rare. Still handle them safely:

| Failure | Behavior |
| --- | --- |
| Invalid request | `400 INVALID_REQUEST` |
| Provider throws | `503 AI_UNAVAILABLE` |
| Unexpected error | existing safe error handler |

The listing creation flow must continue working even if this endpoint fails.

## What Is Intentionally Delayed

- real OpenAI-compatible provider
- prompt tables
- AI task log tables
- database audit logging
- seller accept/apply flow in web UI
- automatic listing mutation
- image analysis
- valuation
- moderation

## Verification Checklist

1. `pnpm --filter @babyloop/ai-core build`
2. `pnpm --filter @babyloop/api build`
3. Start API with existing `DATABASE_URL`.
4. `POST /api/v1/ai/listing-suggestions` with a valid body.
5. Verify invalid body returns `400 INVALID_REQUEST`.
6. Verify existing `/health`, `/api/v1/categories`, `/api/v1/listings`, and listing creation still work.
