# Mobile Scope Status

This document supersedes the original mobile skeleton scope freeze.

## Current status

BabyLoop mobile is no longer only a skeleton. It is an Expo / React Native / TypeScript app with multiple API-backed product flows.

Implemented or mostly implemented:

- app shell and tab navigation,
- login/register,
- secure token storage,
- browse listings,
- listing detail,
- favorites,
- account/security,
- MFA/OTP flow,
- mobile security settings,
- auth session controls,
- mobile login approval management for web login approval,
- messages list/detail foundation,
- realtime messaging foundation,
- sell listing and image-upload model foundations,
- my listings,
- notifications/preferences,
- child profile notes/reminders foundation,
- basket/mock checkout foundation,
- assistant entry,
- Jest P0 test package,
- Maestro smoke foundation.

## Remaining mobile completion scope

Mobile must be completed fully:

- auth edge-case QA,
- MFA/OTP final QA,
- security settings final QA,
- browse/filter parity,
- listing detail parity,
- sell listing completion,
- image upload real-device QA,
- messages realtime hardening,
- image-only message attachments,
- offline/reconnect behavior,
- notifications,
- child notebook/reminders,
- assistant,
- checkout simulation,
- legal links,
- Android keyboard/composer fix,
- Android/iOS safe area/tab polish,
- app icon/splash,
- expanded Maestro E2E,
- real-device S22 manual QA.

## Security boundaries

Mobile must preserve these boundaries:

- no access token in AsyncStorage,
- no refresh token in AsyncStorage,
- no token/secret leak in responses or logs,
- no seller email/phone exposure,
- no private child profile exposure,
- no raw admin data,
- no diagnosis/therapy/medication/treatment/diet-plan assistant behavior,
- no unsafe HTML/script rendering,
- report/block flows remain available without being visually overexposed,
- mobile login must not require mobile approval for itself.

## Deferred to final DevOps package

- store release/build pipeline,
- EAS/signing/release automation,
- production observability,
- production push infrastructure where applicable.

## Mobile OTP/MFA P0 guard

The mobile OTP/MFA boundary is locked by `pnpm security:mobile-auth` and `pnpm test:mobile:p0`.

This guard keeps the following decisions explicit:

- Mobile token persistence uses Expo SecureStore only.
- Mobile login uses password plus e-mail OTP when MFA is enabled.
- MFA-required login is unauthenticated until the OTP challenge succeeds.
- Mobile security toggles require the current password in a modal flow.
- Mobile approval is for approving web login attempts from an already authenticated mobile session.
- Mobile login must not require mobile approval for itself.
- Session and approval UI must not expose token-like values, refresh tokens, password hashes, OTP hashes, cookies, or raw auth/session objects.

## Mobile P0 release gate

`pnpm release:mobile:p0` is the deterministic automated release gate for the current mobile P0 slice.

It runs:

- `pnpm security:mobile-auth`
- `pnpm test:mobile:p0`
- `pnpm --filter @babyloop/mobile typecheck`

It does not run Maestro, does not start Expo, and does not claim real-device S22 manual QA. Expanded Maestro E2E, push infrastructure validation, and real-device S22 manual QA remain outside the automated gate until the mobile runtime setup is stable.

## Mobile notification boundary

Mobile notification preferences and child cadence remain draft-only for external email/push/n8n delivery until delivery logs, idempotency, frequency limiting, and audit are implemented.

`pnpm security:mobile-notifications` protects the mobile notifications/preferences slice.

Scope included:

- in-app notifications,
- unread/read/read-all,
- child lifecycle in-app generation,
- child reminder notification cadence preferences,
- safe notification card rendering.

Scope excluded until a later delivery package:

- native push tokens,
- real push delivery,
- real notification email delivery,
- n8n webhooks,
- queues/workers,
- delivery logs and send audit.

This keeps the surface useful without claiming email/push/n8n delivery before the delivery-log/idempotency foundation exists.

- Mobile notification preference screen-state model keeps child profile cadence selection, draft-only copy, and no-real-delivery boundaries testable without Maestro.

- Mobile child notebook/reminder screen-state model keeps child notes, reminders, in-app cadence boundaries, and no-real-delivery behavior testable without Maestro.

## Notification surface consistency audit

Run pnpm security:notification-consistency-audit before claiming notification release readiness.

This broad audit covers API, web, mobile, and backoffice notification surfaces. It requires deliveryAllowed=false, draftOnly=true, email/push/n8n disabled copy, notification preferences, delivery drafts, push readiness, n8n readiness, observability, and manual QA boundaries to stay aligned.

This audit does not enable real email sending, does not enable real push sending, and does not enable real n8n workflow triggering. It does not enable queues, provider calls, webhook calls, native push token collection, or production notification delivery.

## Auth/session/CSRF/realtime/read-state audit

Run pnpm security:auth-session-realtime-readstate before claiming auth/session/realtime/read-state release readiness.

This audit covers httpOnly cookies, CSRF, public access cookie migration, refresh/logout/session revoke behavior, backoffice admin auth, realtime room access, read-state, unread-count reconciliation, and the release dependency map across API, web, backoffice, and mobile.

Auth/session/realtime/read-state surfaces do not expose accessToken, do not expose refreshToken, do not expose passwordHash, do not expose cookie, and do not expose authorization.

Mobile messaging/realtime parity pending remains an explicit P0 gap until the mobile realtime implementation is completed.

Auth/session/CSRF/realtime/read-state audit does not expose accessToken, does not expose refreshToken, does not expose passwordHash, does not expose cookie, and does not expose authorization in user-facing DTOs, docs, logs, web storage, or mobile storage.
