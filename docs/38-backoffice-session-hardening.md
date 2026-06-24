# Backoffice Session Hardening

## Purpose

Backoffice has higher-risk moderation and marketplace operations than the public app. Admin access tokens must not be stored in browser-readable storage.

## Implemented

Backoffice now uses dedicated cookie-backed auth endpoints:

```txt
POST /api/v1/auth/backoffice/login
POST /api/v1/auth/backoffice/refresh
POST /api/v1/auth/backoffice/logout
GET /api/v1/auth/backoffice/me
```

Successful backoffice login and refresh:

- verify the user is an admin
- set `babyloop_backoffice_access_token`
- use an httpOnly cookie
- use `SameSite=Lax`
- use `Path=/`
- align max age with the API access-token TTL
- add `Secure` in production
- return safe user/profile data only
- do not return `accessToken` in JSON

Backoffice logout clears the backoffice access cookie and the existing refresh-token cookie.

The API auth plugin still accepts `Authorization: Bearer` first for public compatibility, then falls back to the explicit backoffice access cookie.

## Backoffice Browser Rules

Backoffice client code must not:

- store access tokens in `localStorage`
- store access tokens in `sessionStorage`
- store access tokens in readable cookies
- put access tokens in URLs
- log access tokens or full auth payloads

Backoffice API calls use `credentials: "include"` and retry once through `/api/v1/auth/backoffice/refresh` after a 401.

## CSRF Posture

This hardening step uses httpOnly cookies, `SameSite=Lax`, credentialed CORS origin restrictions, and admin-only authorization.

A full CSRF token mechanism is still deferred. Before production hardening is complete, add a double-submit or synchronizer token for unsafe backoffice methods.

## Compatibility

Public auth endpoints still return Bearer access tokens for now:

- `/api/v1/auth/login`
- `/api/v1/auth/refresh`
- `/api/v1/auth/mfa/verify`
- `/api/v1/auth/register`

Do not remove this compatibility until the public web app has its own migration plan.

## Manual Validation

```bash
grep -R "localStorage|sessionStorage|BACKOFFICE_AUTH_TOKEN_STORAGE_KEY|setAuthToken|getAuthToken|Authorization:.*Bearer" -n apps/backoffice/src | sort
```

Expected result: no backoffice access-token storage helpers or Bearer header construction.

Run targeted auth validation manually:

```bash
TEST_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/babyloop_test pnpm --filter @babyloop/api exec vitest run test/auth.integration.test.ts --config vitest.config.ts
pnpm --filter @babyloop/api typecheck
pnpm --filter @babyloop/backoffice typecheck
```

## Deferred

- public web auth cookie migration
- full CSRF token enforcement
- session/device management UI
- granular backoffice RBAC
- BFF route protection

## Email ops secret boundary

Backoffice email ops preview may show provider type and missing configuration keys, but must never expose SMTP passwords, Resend API keys, raw email tokens, reset tokens, verification tokens, or auth/session data.
