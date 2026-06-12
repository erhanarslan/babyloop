# 54 - Backoffice CSRF Token Enforcement

## Status

Implemented as a production hardening step for cookie-authenticated backoffice mutations.

## Scope

This change adds a double-submit CSRF token boundary for backoffice requests that use HttpOnly cookie authentication.

Protected requests:

- Non-safe HTTP methods: `POST`, `PUT`, `PATCH`, `DELETE`
- Cookie-authenticated backoffice admin routes under `/api/v1/admin/*`
- Cookie-authenticated backoffice logout at `/api/v1/auth/backoffice/logout`

Not protected by this CSRF layer:

- Safe methods: `GET`, `HEAD`, `OPTIONS`
- Bearer-token API clients
- Public auth/login/refresh routes
- Public marketplace routes

## Token model

- Access token remains HttpOnly in `babyloop_backoffice_access_token`.
- CSRF token is stored in `babyloop_backoffice_csrf_token` as a readable SameSite=Lax cookie.
- Client sends the token in `x-babyloop-csrf-token` for unsafe backoffice requests.
- Server compares the cookie token and header token with timing-safe equality.

## Privacy and security boundaries

The CSRF token is not an authentication credential. It only proves that the browser script can read the same-site CSRF cookie. The actual backoffice identity remains inside the HttpOnly access token cookie.

The implementation does not expose:

- access tokens to browser storage
- refresh tokens to JavaScript
- user email/contact data
- raw message bodies
- reporter identity
- sensitive-access payloads
- raw AI input/output

## Backoffice client behavior

The backoffice auth client fetches `/api/v1/auth/backoffice/csrf` after login and after refresh. Unsafe requests sent via `authFetch` automatically include `x-babyloop-csrf-token`.

## Validation

Recommended checks:

```bash
pnpm --filter @babyloop/api exec vitest run test/backoffice-csrf.test.ts --config vitest.config.ts
pnpm --filter @babyloop/api exec vitest run test/auth.integration.test.ts --config vitest.config.ts
pnpm --filter @babyloop/api typecheck
pnpm --filter @babyloop/backoffice typecheck
```

Security grep:

```bash
grep -R "localStorage\|sessionStorage\|BACKOFFICE_AUTH_TOKEN_STORAGE_KEY\|setAuthToken\|getAuthToken\|clearAuthToken\|Authorization:.*Bearer" -n \
  apps/backoffice/src \
  | sort
```

Expected result: no token storage regression.

## Deferred work

- Per-role RBAC permissions for admin actions.
- Audit event for repeated CSRF failures if abuse signal volume becomes useful.
- CSRF retry UX for very stale tabs.
