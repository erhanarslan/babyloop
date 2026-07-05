# Public auth cookie migration plan

This plan defines the readiness gate for moving BabyLoop public web auth toward a cleaner cookie/session model. It is a planning and boundary package only: it does not change runtime auth behavior.

Guard command:

```bash
pnpm security:public-auth-cookie-migration
```

This guard is wired into:

```bash
pnpm beta:critical-smoke
```

## Current status

Current status: blocked/readiness-only.

Public web migration remains blocked until explicit implementation, focused tests, manual QA, and rollback notes exist.

This plan does not introduce document-cookie token handling, does not store access tokens in localStorage or sessionStorage, does not change cookie names, does not add new auth headers, and does not modify runtime auth behavior.

## Migration goal

The target direction is a consistent public web auth model with:

- httpOnly refresh token cookie
- short-lived public access session state where needed
- strict CSRF handling for unsafe mutations
- sameSite policy explicitly documented
- secure cookie behavior for staging and production
- logout that revokes server session and clears client-visible state
- session refresh that avoids flicker and avoids token leakage
- MFA/OTP continuation flow that works on public web and mobile

## Required implementation checklist

Before runtime migration can start:

- auth cookie names and ownership documented
- refresh token rotation behavior documented
- CSRF header/source documented
- sameSite policy documented per environment
- secure cookie behavior documented per environment
- CORS allowlist reviewed for local, staging, production
- public web register/login/logout/refresh tests listed
- protected route and auth-only nav tests listed
- MFA/OTP continuation tests listed
- favorites and messaging auth regression tests listed
- rollback plan documented
- security:auth-leaks passing
- beta:critical-smoke passing

## Manual QA coverage

Manual QA must cover register, login, refresh, logout, MFA/OTP, favorites, messaging, and protected routes.

The run must include:

- fresh anonymous visit
- register and verify authenticated UI
- login and auth-only nav
- refresh after browser reload
- logout and protected route denial
- session expiry handling
- MFA/OTP required response handling
- favorite action redirect/return behavior
- messaging protected route behavior
- CSRF rejection for unsafe mutation without token
- no token/cookie/OTP/password leakage in UI or logs

## Rollback

Rollback must be possible by reverting the auth migration commit and restoring the previous cookie/session behavior.

Required rollback evidence:

- previous commit SHA
- changed files list
- database/session compatibility note
- cookie clearing behavior note
- manual smoke result before and after rollback

## Security non-goals

This package does not enable new auth provider behavior, does not write token values into browser storage, does not expose refresh tokens to JavaScript, does not weaken CSRF, does not relax CORS, and does not change runtime auth behavior.

## Release decision

A public auth cookie migration release is blocked until:

- implementation PR exists
- focused tests pass
- beta critical smoke passes
- manual QA evidence is recorded
- rollback plan is reviewed
- go/no-go decision is recorded

Exact guard wording: public web migration remains blocked until explicit implementation.
Exact guard wording: manual QA must cover register, login, refresh, logout, MFA/OTP, favorites, messaging, and protected routes.
