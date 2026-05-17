# Auth Implementation Plan

## Goal

Implementation note: The completed first auth slice uses a signed Bearer access token stored by the web client in `localStorage` for development simplicity. Passwords are hashed with Node's built-in `scrypt`. HTTP-only cookies, refresh tokens, a session table, email verification, password reset, and Argon2id remain production hardening options for a later phase.

Auth hardening step 1 is implemented:

- `AUTH_SECRET` is required when `DATABASE_URL` is configured, unless `ALLOW_AUTH_UNAVAILABLE=true` is explicitly set for local unavailable-mode testing.
- Default access token TTL is 15 minutes. `AUTH_TOKEN_TTL_SECONDS` remains available for local dev overrides.
- Register/login emails are trimmed and lowercased before duplicate checks or credential lookup.
- Register/login endpoints have simple configurable rate limiting.

Auth now removes user-facing client-controlled profile ids from protected listing and favorite writes. The API derives ownership from the verified token.

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
- Web stores a signed Bearer access token in `localStorage` for the current local-first slice.
- Protected API routes derive the current user/profile from the verified session, never from request body ids.

This keeps the implementation portfolio-friendly, auditable, and small without introducing OAuth, external auth vendors, or admin RBAC too early.

## User/Profile Relationship

Add a `users` table first:

| Field | Notes |
| --- | --- |
| `id` | UUID primary key. |
| `email` | Unique, normalized lowercase. |
| `password_hash` | `scrypt` hash for the current implementation; Argon2id is delayed hardening. |
| `created_at` | Timestamp. |
| `updated_at` | Timestamp. |

Update `profiles` later in the same auth slice:

| Field | Notes |
| --- | --- |
| `user_id` | Nullable FK to `users.id` at first. Unique when present. |

`profiles.user_id` should be nullable initially so current seed profiles and existing local listings/favorites keep working during migration.

## Session/Token Strategy

First slice uses a signed stateless Bearer access token returned by `register` and `login`.

Token payload should stay small:

- `userId`
- `profileId`
- `iat`
- `exp`

Use a server-only `AUTH_SECRET` environment variable. Do not expose it to Next.js client code.

`AUTH_SECRET` must be at least 32 characters. Refresh tokens, a server-side session table, and HTTP-only cookie transport are delayed.

## Password Hashing

Use `scrypt` for password hashing in the first slice.

Rules:

- Never store raw passwords.
- Validate password length before hashing.
- Return generic login errors.
- Do not log passwords or password hashes.
- Keep auth rate limiting enabled for register/login endpoints.

## API Protection Strategy

Create a small auth utility/plugin in `apps/api`:

- parse `Authorization: Bearer <token>`
- verify token signature and expiry
- load user/profile reference when needed
- decorate request with `currentUser`

Protected routes:

- `POST /api/v1/listings`
- `POST /api/v1/favorites`
- `DELETE /api/v1/favorites`
- `GET /api/v1/favorites`
- `GET /api/v1/profiles/:profileId/favorites` as self-only compatibility
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

Confirmed removed from user-facing flows:

- `LOCAL_DEV_PROFILE_ID` in `apps/web`
- request body `profile_id` in favorites UI calls
- temporary local seller id in listing creation

Keep seed data:

- existing seeded profiles can remain without `user_id`
- add one seeded dev user linked to one seeded profile only if useful for local verification
- do not destroy existing sample listings/favorites

## Protecting Listing Creation

Implemented:

- require Bearer token
- derive seller profile from session
- keep request body camelCase listing fields
- reject unauthenticated requests with `401`
- preserve existing validation for category, price, type, condition, image URLs

## Protecting Favorites

Implemented:

- require Bearer token for add/remove/list
- request body only includes `listingId`
- derive `profileId` from session
- reject favoriting the current user's own listing with `CANNOT_FAVORITE_OWN_LISTING`
- reject favoriting inactive listings
- keep duplicate favorite behavior idempotent
- keep favorite events with actor profile from session, and only log add/remove events when state actually changes
- prefer `GET /api/v1/favorites` for web UI
- keep `GET /api/v1/profiles/:profileId/favorites` protected and self-only for compatibility

## Security Risks

| Risk | First-slice mitigation |
| --- | --- |
| Client spoofing another profile id | Remove client-controlled profile ids from write endpoints. |
| Stolen token | Expiry, `AUTH_SECRET`, and future HTTP-only cookie hardening. |
| Password leakage | `scrypt`, no password logging, generic login errors. |
| Seed data breakage | Make `profiles.user_id` nullable initially. |
| XSS/localStorage exposure | Keep UI small, avoid unsafe HTML, move to HTTP-only cookies later. |
| CSRF | Lower risk with Bearer header; revisit if cookies are introduced. |
| Brute force login | Basic register/login rate limiting is implemented; stronger IP/account risk controls are delayed. |
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
- login returns signed access token
- `/auth/me` returns current user/profile with Bearer token
- unauthenticated listing/favorite writes return `401`
- authenticated listing creation still works
- authenticated favorite/unfavorite still works
- authenticated `GET /api/v1/favorites` works
- `GET /api/v1/profiles/:profileId/favorites` is self-only
- public read endpoints still work
- seeded data remains usable locally

## Delayed Features

Do not include in the first auth slice:

- OAuth
- social login
- password reset
- email verification
- refresh tokens
- user/session table
- admin RBAC
- payments
- account deletion
- multi-profile households
- child profiles
- device/session management UI
- advanced rate limiting, account lockout, and abuse analytics

## Verification Checklist

- `pnpm build`
- `pnpm typecheck`
- migration generation
- migration run on local database
- register request creates user/profile
- login request returns token
- `/api/v1/auth/me` works with Bearer token
- protected listing creation works with Bearer token
- protected favorites add/remove/list works with Bearer token
- unauthenticated protected writes return `401`
- `/browse` and listing detail remain public
