# Refactoring Plan

## Purpose

BabyLoop is working, but several API route files and web components are starting to carry routing, validation, data access, and UI state in one place. This plan defines the smallest safe refactoring path before adding messaging, moderation, RAG, pricing, admin, mobile, or workers.

Refactoring must preserve current behavior. It must not add product features, redesign UI, or reintroduce user-facing `profile_id` ownership flows.

## Current Large Files

| File | Approx. lines | Risk |
| --- | ---: | --- |
| `apps/api/src/routes/listings.routes.ts` | 462 | Route handlers, validation, DB queries, formatting, and auth helper logic are mixed. |
| `apps/api/src/routes/favorites.routes.ts` | 343 | Ownership checks, route handlers, DB queries, event logging, and response mapping are mixed. |
| `apps/web/src/components/sell-listing-form.tsx` | 375 | Form state, API calls, AI suggestion state, validation hints, and rendering are mixed. |
| `apps/api/src/routes/auth.routes.ts` | 257 | Auth route handlers, request schemas, response builders, and DB lookups are mixed. |
| `apps/api/src/routes/ai-listing-suggestions.routes.ts` | 172 | Route handling and audit logging are still together. |
| `apps/web/src/components/favorites-list.tsx` | 128 | Fetching and rendering can split once favorites grows. |
| `apps/web/src/components/favorite-button.tsx` | 118 | Auth gate, fetch logic, and button UI are together. |
| `apps/web/src/lib/api.ts` | 100 | Shared API types and fetch helpers will become crowded as endpoints grow. |

## Target Folder Boundaries

### API

Recommended shape per feature:

```text
apps/api/src/features/
  listings/
    listings.routes.ts
    listings.schemas.ts
    listings.service.ts
    listings.mapper.ts
  favorites/
    favorites.routes.ts
    favorites.schemas.ts
    favorites.service.ts
    favorites.mapper.ts
  auth/
    auth.routes.ts
    auth.schemas.ts
    auth.service.ts
    auth.responses.ts
  ai/
    listing-suggestions.routes.ts
    listing-suggestions.schemas.ts
    ai-audit.service.ts
```

Keep `apps/api/src/routes/` only as a thin registration layer or migrate route files feature-by-feature. Do not do a repo-wide move in one step.

### Web

Recommended shape per feature:

```text
apps/web/src/features/
  listings/
    api.ts
    SellListingForm.tsx
    SellListingFields.tsx
    AiSuggestionPanel.tsx
    ListingCard.tsx
    ListingDetailPanel.tsx
  favorites/
    api.ts
    FavoriteButton.tsx
    FavoritesList.tsx
    FavoriteCard.tsx
  auth/
    api.ts
    AuthForm.tsx
    AuthNav.tsx
```

Pages should stay as route-level containers that fetch initial data and compose feature components.

## API Route, Service, and Schema Separation

Route files should:

- register routes
- call Zod schemas
- call service functions
- translate known errors into HTTP responses
- avoid direct multi-step business logic

Service files should:

- own database reads/writes
- enforce ownership from `CurrentUser`
- create events
- keep listing/favorite behavior idempotent where currently expected
- never accept user-facing `profile_id` as ownership authority

Schema files should:

- export Zod request schemas per feature
- preserve current public contracts
- keep camelCase listing create input
- keep favorite write input as `listing_id` until deliberately changed

Mapper files should:

- convert database rows to API response DTOs
- centralize price/date/category response formatting
- avoid leaking database-only fields such as `password_hash`

## Web Page and Component Separation

Page files should:

- remain small route containers
- fetch public server data where useful
- pass API base URL and initial data into components
- not contain large form logic

Large components should split into:

- container: owns state and submit handlers
- form fields: presentational inputs
- panels: AI suggestion, errors, empty states
- UI pieces: cards, buttons, metadata rows

`sell-listing-form.tsx` should be the first web split because it contains manual listing creation and mock AI suggestion behavior in one file.

## API Client Separation

Current `apps/web/src/lib/api.ts` can stay for shared base helpers, but endpoint-specific calls should move into feature API modules as the next refactor:

- `features/listings/api.ts`
- `features/favorites/api.ts`
- `features/auth/api.ts`
- `features/ai/api.ts`

Each module should keep typed request/response helpers close to the feature using them.

## Auth Client Separation

Current `auth-client.ts` is small enough to keep. Future split only when needed:

- token storage
- auth headers
- auth events
- current user fetch

No user-facing flow should send `profile_id` or `seller_profile_id`. Protected writes must continue using `Authorization: Bearer <token>`.

## Feature Module Boundaries

| Feature | Owns | Must not own |
| --- | --- | --- |
| Auth | users, profile link, token verification, safe user/profile responses | marketplace listing/favorite business logic |
| Listings | listing create/read, images metadata, listing events | auth token parsing, favorites state |
| Favorites | favorite add/remove/list, favorite events, ownership checks | recommendations or notifications |
| AI listing suggestions | mock provider call, response validation, audit logging | listing creation or pricing |
| Database package | schema, migrations, seed | API route behavior |

## Refactor Now

Do these in small, separately verified steps:

1. Extract listing request schemas and response mappers from `listings.routes.ts`.
2. Extract listing read/create DB logic into `features/listings/listings.service.ts`.
3. Extract favorite request schema, mapper, and service from `favorites.routes.ts`.
4. Split `sell-listing-form.tsx` into container, manual listing fields, and AI suggestion panel.
5. Move web favorite API calls into `features/favorites/api.ts`.

Each step should preserve all existing routes, UI text, and response shapes.

## Delay

Delay these until the related feature exists or the current file becomes a real bottleneck:

- moving every API route into `features/` at once
- package-level shared Zod schemas
- generated API clients
- TanStack Query or SWR
- admin/mobile UI extraction
- design system or `packages/ui`
- repository-wide import alias refactor
- auth migration from localStorage token to HTTP-only cookie
- AI audit admin views

## Verification Checklist

After each refactor step:

- `pnpm typecheck`
- `pnpm build`
- `GET /health`
- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `GET /api/v1/auth/me`
- `GET /api/v1/categories`
- `GET /api/v1/listings`
- `GET /api/v1/listings/:id`
- `POST /api/v1/listings` requires auth and uses token profile
- `POST /api/v1/favorites` requires auth
- `DELETE /api/v1/favorites` requires auth
- `GET /api/v1/favorites` requires auth
- `/browse` remains public
- `/listings/:id` remains public
- `/sell` preserves manual create and mock AI suggestion
- `/favorites` uses the logged-in token flow

For ownership checks:

- do not accept user-facing `profile_id`
- do not accept user-facing `seller_profile_id`
- reject unauthenticated protected writes with `401`
- keep `/profiles/:profileId/favorites` protected and self-only while it exists

