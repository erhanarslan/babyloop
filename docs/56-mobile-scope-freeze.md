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
