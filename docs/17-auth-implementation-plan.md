# Auth Implementation Plan

## Goal

Implementation note: The completed first auth slice currently uses a signed Bearer access token stored by the web client in `localStorage` for development simplicity. Passwords are hashed with Node's built-in `scrypt`. HTTP-only cookies and Argon2id remain production hardening options for a later phase.
BabyLoop currently uses temporary local profile ids for listing creation and favorites. Auth must replace all user-facing client-controlled `profile_id` behavior before adding more user-owned features.

Public read endpoints stay public:

- `GET /health`
- `GET /api/v1/categories`
- `GET /api/v1/listings`
- `GET /api/v1/listings/:id`
- `POST /api/v1/ai/listing-suggestions` for now

## Recommended Auth Approach

Use first-party email/password auth in the Fastify API for the first slice.

Recommendation:

- `users` table owns login identity.
- `profiles` table owns marketplace display identity.
- API creates a profile during registration.
- Web stores the session token in an HTTP-only cookie.
- Protected API routes derive the current user/profile from the verified session, never from request body ids.

This keeps the implementation portfolio-friendly, auditable, and small without introducing OAuth, external auth vendors, or admin RBAC too early.

## User/Profile Relationship

Add a `users` table first:

| Field | Notes |
| --- | --- |
| `id` | UUID primary key. |
| `email` | Unique, normalized lowercase. |
| `password_hash` | Argon2id hash. |
| `created_at` | Timestamp. |
| `updated_at` | Timestamp. |

Update `profiles` later in the same auth slice:

| Field | Notes |
| --- | --- |
| `user_id` | Nullable FK to `users.id` at first. Unique when present. |

`profiles.user_id` should be nullable initially so current seed profiles and existing local listings/favorites keep working during migration.

## Session/Token Strategy

First slice should use a signed stateless session token stored in an HTTP-only cookie.

Recommended cookie settings:

- `httpOnly: true`
- `sameSite: lax`
- `secure: false` in local dev, `true` in production
- short but usable expiry, for example 7 days

Token payload should stay small:

- `userId`
- `profileId`
- `iat`
- `exp`

Use a server-only `AUTH_SECRET` environment variable. Do not expose it to Next.js client code.

Refresh tokens are delayed. A single signed cookie is enough for the first local auth slice and avoids extra tables.

## Password Hashing

Use Argon2id for password hashing.

Rules:

- Never store raw passwords.
- Validate password length before hashing.
- Return generic login errors.
- Do not log passwords or password hashes.
- Consider rate limiting after the basic slice is stable.

## API Protection Strategy

Create a small auth utility/plugin in `apps/api`:

- parse auth cookie
- verify token signature and expiry
- load user/profile reference when needed
- decorate request with `currentUser`

Protected routes:

- `POST /api/v1/listings`
- `POST /api/v1/favorites`
- `DELETE /api/v1/favorites`
- `GET /api/v1/auth/me`

Route behavior changes:

- Listing creation uses `request.currentUser.profileId` as `seller_profile_id`.
- Favorites use `request.currentUser.profileId`.
- `profile_id` must be removed from POST/DELETE favorites request bodies.
- Client-provided seller/profile ids are rejected or ignored.

## Web Login/Register Flow

Minimal pages:

- `/register`
- `/login`

Register form:

- email
- password
- display name
- optional city

Login form:

- email
- password

After login/register:

- redirect to `/browse` or previous page
- `/sell` can create listings as the logged-in profile
- listing detail favorite button works for the logged-in profile

Keep UI small and practical. Do not add OAuth, password reset, or email verification in this slice.

## Removing Temporary Profile Id Usage

Remove user-facing usage of:

- `LOCAL_DEV_PROFILE_ID` in `apps/web`
- request body `profile_id` in favorites UI calls
- temporary local seller id in listing creation

Keep seed data:

- existing seeded profiles can remain without `user_id`
- add one seeded dev user linked to one seeded profile only if useful for local verification
- do not destroy existing sample listings/favorites

## Protecting Listing Creation

Current:

- API uses a temporary seeded seller profile id.

First auth slice:

- require auth cookie
- derive seller profile from session
- keep request body camelCase listing fields
- reject unauthenticated requests with `401`
- preserve existing validation for category, price, type, condition, image URLs

## Protecting Favorites

Current:

- API accepts `profile_id` and `listing_id`.

First auth slice:

- require auth cookie for add/remove
- request body only includes `listing_id` or camelCase `listingId`
- derive `profileId` from session
- keep duplicate favorite behavior idempotent
- keep favorite events with actor profile from session

`GET /api/v1/profiles/:profileId/favorites` can remain public temporarily for local verification, but a later privacy pass should add current-user-only favorites or visibility rules.

## Security Risks

| Risk | First-slice mitigation |
| --- | --- |
| Client spoofing another profile id | Remove client-controlled profile ids from write endpoints. |
| Stolen token | HTTP-only cookie, expiry, `AUTH_SECRET`. |
| Password leakage | Argon2id, no password logging, generic login errors. |
| Seed data breakage | Make `profiles.user_id` nullable initially. |
| CSRF | `sameSite: lax`; add CSRF token later if cross-site writes become a concern. |
| Brute force login | Delay full rate limiting, but document and add soon after auth works. |
| Overexposed user data | `GET /auth/me` returns only safe user/profile fields. |

## First Auth Slice

Implement in small follow-up steps:

1. Add `users` table and nullable unique `profiles.user_id`.
2. Add auth config env vars and update `.env.example`.
3. Add password hashing and signed session utilities.
4. Add `POST /api/v1/auth/register`.
5. Add `POST /api/v1/auth/login`.
6. Add `GET /api/v1/auth/me`.
7. Protect `POST /api/v1/listings`.
8. Protect `POST /api/v1/favorites` and `DELETE /api/v1/favorites`.
9. Add minimal `/register` and `/login` web pages.
10. Remove user-facing temporary profile id usage.

Done criteria:

- register creates user and linked profile
- login sets HTTP-only session cookie
- `/auth/me` returns current user/profile
- unauthenticated listing/favorite writes return `401`
- authenticated listing creation still works
- authenticated favorite/unfavorite still works
- public read endpoints still work
- seeded data remains usable locally

## Delayed Features

Do not include in the first auth slice:

- OAuth
- social login
- password reset
- email verification
- refresh tokens
- admin RBAC
- payments
- account deletion
- multi-profile households
- child profiles
- device/session management UI
- rate limiting beyond minimal follow-up planning

## Verification Checklist

- `pnpm build`
- `pnpm typecheck`
- migration generation
- migration run on local database
- register request creates user/profile
- login request sets cookie
- `/api/v1/auth/me` works with cookie
- protected listing creation works with cookie
- protected favorites add/remove works with cookie
- unauthenticated protected writes return `401`
- `/browse` and listing detail remain public
