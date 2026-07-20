# Full beta critical smoke automation

The full beta critical smoke automation is the release gate command for BabyLoop beta readiness. It collects the most important automated guards and typechecks into a single command:

```bash
pnpm beta:critical-smoke
```

Boundary/config guard:

```bash
pnpm security:beta-critical-smoke
```

## What the command runs

The smoke runner executes these gates in sequence:

- `pnpm security:beta-critical-smoke`
- `pnpm test:api:security`
- `pnpm security:assistant-safety-guard`
- `pnpm security:storage-ops-preview`
- `pnpm qa:mobile:s22`
- `pnpm security:notification-n8n-readiness`
- `pnpm security:notification-push-readiness`
- `pnpm security:notification-delivery-transitions`
- `pnpm security:notification-ops-preview`
- `pnpm security:notification-delivery-log`
- `pnpm security:auth-leaks`
- `pnpm release:artifacts`
- `pnpm --filter @babyloop/api typecheck`
- `pnpm --filter @babyloop/backoffice typecheck`
- `pnpm --filter @babyloop/web typecheck`
- `pnpm --filter @babyloop/mobile typecheck`

If memory is tight on the M1 8GB laptop, typecheck-only steps can be skipped temporarily with:

```bash
BABYLOOP_BETA_SMOKE_SKIP_TYPECHECK=1 pnpm beta:critical-smoke
```

That skip mode is only for local iteration. It is not acceptable for a beta release decision.

## Explicit non-goals

This automation does not replace manual physical Galaxy S22 QA evidence.

It also does not enable push sender, does not enable n8n workflow, does not enable S3/R2 external storage, and does not enable autonomous RAG answers. It is a release gate, not a feature flag.

## Required evidence before beta

Before a beta release decision, keep the following evidence in the local release notes or issue tracker:

- full `pnpm beta:critical-smoke` output
- physical Galaxy S22 QA pass/fail result
- known blocked items
- screenshots or recordings for failures
- release decision: go / no-go

## Coverage

The command intentionally covers:

- assistant safety guard and hallucination/grounding boundary
- storage ops preview and external storage disabled boundary
- mobile real-device S22 QA checklist presence
- notification readiness: n8n disabled, push disabled, delivery transitions guarded, ops preview guarded, delivery log guarded
- auth-leak and release-artifact guards
- API/backoffice/web/mobile typechecks

## Deployment readiness gate

Full beta critical smoke automation includes `pnpm security:deployment-readiness`.

Deployment readiness gate verifies staging/production readiness documentation for environment variables, secrets, database migration, rollback, observability, health checks, and manual go/no-go approval. It does not deploy, does not create cloud resources, and does not enable AWS, Kubernetes, S3/R2, Redis, n8n, push, email, payment, production database access, or autonomous RAG answers.

## Public auth cookie migration

Full beta critical smoke automation includes `pnpm security:public-auth-cookie-migration`.

Public auth cookie migration planning verifies httpOnly, sameSite, secure cookie, CSRF, refresh token, logout, session refresh, protected routes, MFA/OTP, manual QA, and rollback coverage before runtime auth changes. It does not change runtime auth behavior, does not introduce document-cookie token handling, and does not store access tokens in localStorage or sessionStorage.

## Notification sender provider design gate

Full beta critical smoke automation includes `pnpm security:notification-sender-provider-design`.

Notification sender provider design gate verifies provider selection, sandbox, consent, rate limit, retry, dead-letter, audit, observability, rollback, email sender readiness, push sender readiness, and n8n workflow readiness before real delivery implementation. It does not enable real email sending, real push sending, real n8n workflow triggering, provider credentials, webhook calls, queue jobs, or production notification delivery.

## Notification observability taxonomy

Full beta critical smoke automation includes `pnpm security:notification-observability-taxonomy`.

Notification observability taxonomy verifies event taxonomy, privacy-safe dimensions, metrics, dashboard plans, raw payload logging boundary, PII restrictions, retry/dead-letter observability, preference observability, and click tracking readiness before real notification delivery. It does not enable metrics exporters, tracing exporters, provider calls, queue jobs, webhook calls, real email sending, real push sending, or real n8n workflow triggering.

## Notification consent/preference policy

Full beta critical smoke automation includes `pnpm security:notification-consent-preference`.

Notification consent/preference policy verifies consent, preference, opt-out, audit, rate limit, blocked user safety, mute/snooze windows, source/channel scopes, privacy boundaries, and raw contact logging before real notification delivery. It does not enable real email sending, real push sending, real n8n workflow triggering, provider calls, queue jobs, webhook calls, or unconsented delivery.

## Mobile OTP/MFA hardening

Full beta critical smoke automation includes `pnpm security:mobile-otp-mfa-hardening`.

Mobile OTP/MFA hardening verifies SecureStore, OTP, MFA, rate limit, session refresh, logout cleanup, protected route return, network recovery, invalid/expired code states, resend cooldown, and Galaxy S22 QA readiness. It does not change runtime auth behavior, does not enable SMS OTP, does not enable authenticator MFA, and does not enable push security notification.

## Child notebook/reminder hardening

Full beta critical smoke automation includes `pnpm security:child-notebook-reminder-hardening`.

Child notebook/reminder hardening verifies free note, recurring reminder, advance reminder, notification preference, web child notebook, mobile child notebook, complete/cancel/snooze, owner-only access, inactive child profile handling, and no medical/therapy/diagnosis/drug/diet advice. It does not create runtime CRUD, schedule queue jobs, send notifications, call providers, or trigger n8n.

## Notification preference QA

Full beta critical smoke automation includes `pnpm security:notification-preference-qa`.

Notification preference QA verifies backoffice notification preferences, mobile notification preferences, web notification preferences, opt-out, audit, rate limit, blocked user safety, raw contact logging, and manual QA evidence. It does not enable real sending, provider calls, queue jobs, or webhook calls.

## Release artifact guard UX

`pnpm release:artifacts` must clearly separate tracked generated artifacts from untracked/filesystem artifacts. `pnpm release:clean` handles cleanable generated artifacts; tracked generated artifacts require intentional `git rm` and a commit. The bypass is diagnostic-only and must not be used to pass beta/release flows.

## Mobile P0 release gate

Full beta critical smoke automation includes `pnpm release:mobile:p0` as the deterministic device-free Mobile P0 release gate.

Guard wording: includes pnpm release:mobile:p0 as the deterministic device-free Mobile P0 release gate. This gate runs `pnpm security:mobile-auth`, `pnpm security:mobile-notifications`, `pnpm test:mobile:p0`, and `pnpm --filter @babyloop/mobile typecheck`.

This mobile P0 gate does not run Maestro or require ADB, does not start Expo, and does not replace manual physical Galaxy S22 QA evidence. Expanded Maestro E2E and real-device S22 QA remain separate backlog/manual QA tracks until device setup is stable.\n
## CI Mobile P0 parity

GitHub Actions includes a device-free CI Mobile P0 parity job that runs `pnpm security:ci-mobile-p0-parity`, `pnpm security:mobile-p0-gate`, and `pnpm release:mobile:p0`.

This job does not run Maestro, does not require ADB, does not start Expo, and does not require a Postgres service. Real-device S22 QA and expanded Maestro E2E remain separate backlog/manual QA tracks.

## Child reminder API scheduling boundary

Full beta critical smoke automation includes `pnpm security:child-reminder-api-schedule`.

This guard keeps child reminder delivery candidates due-state aware: future reminders are skipped with `reminder_not_due`, invalid dates are skipped with `reminder_invalid_date`, and non-scheduled reminders are skipped with `reminder_not_scheduled`.

It does not run queue jobs, does not send email, does not send push, and does not trigger n8n.

## Image upload/review storage boundary

Full beta critical smoke automation includes pnpm security:image-upload-review-storage.

This guard confirms that seller upload responses, admin image review responses, public listing responses, admin listing detail, and authenticity audit metadata do not expose objectKey, filePath, contentHash, credentials, tokens, raw provider output, raw upload body, base64 image data, storageDriver, uploadRoot, or local absolute paths.

It does not enable S3/R2 rollout, signed upload, bucket mutation, CDN purge, or queue workers.

## Messaging safety full-flow boundary

Full beta critical smoke automation includes pnpm security:messaging-safety-full-flow.

The guard confirms unsafe message bodies are rejected before persistence, notification creation, and realtime publish; blocked/non-participant access remains denied; realtime join remains membership-gated; and admin conversation review remains redacted by default.

It does not add a new realtime provider and does not expose email, phone, accessToken, refreshToken, cookie, authorization, passwordHash, or raw auth/session data.

Messaging safety full-flow boundary does not expose authorization in public, realtime, or admin default DTOs.

Messaging safety full-flow boundary does not expose email, does not expose phone, does not expose accessToken, does not expose refreshToken, does not expose cookie, and does not expose authorization in public, realtime, or admin default DTOs.

Image upload/review storage boundary does not expose objectKey, does not expose filePath, and does not expose contentHash in public or admin API responses.

## Public safety abuse-flow audit

Run pnpm security:public-safety-abuse-flow before claiming report/block/moderation release readiness.

This audit covers report/block/moderation, fail-closed messaging safety, hidden menu public safety actions, admin redaction, sensitive access, and audit readiness across API, web, mobile, and backoffice surfaces.

Public safety and default admin review DTOs do not expose email, do not expose phone, do not expose accessToken, do not expose refreshToken, do not expose passwordHash, do not expose cookie, do not expose authorization, and do not expose raw message body.

Mobile safety surface pending remains an explicit tracked gap until mobile report/block UI is implemented.

Public safety abuse-flow audit does not expose email, does not expose phone, does not expose accessToken, does not expose refreshToken, does not expose passwordHash, does not expose cookie, does not expose authorization, and does not expose raw message body in public safety or default admin review DTOs.

## Auth/session/CSRF/realtime/read-state audit

Run pnpm security:auth-session-realtime-readstate before claiming auth/session/realtime/read-state release readiness.

This audit covers httpOnly cookies, CSRF, public access cookie migration, refresh/logout/session revoke behavior, backoffice admin auth, realtime room access, read-state, unread-count reconciliation, and the release dependency map across API, web, backoffice, and mobile.

Auth/session/realtime/read-state surfaces do not expose accessToken, do not expose refreshToken, do not expose passwordHash, do not expose cookie, and do not expose authorization.

Mobile messaging/realtime parity pending remains an explicit P0 gap until the mobile realtime implementation is completed.

## Mobile messaging/realtime parity audit

Run pnpm security:mobile-messaging-realtime-parity before claiming mobile messaging, notification unread-count, or read-state release readiness.

This audit covers API, web, and mobile read-state, unread-count, realtime, logout/session cleanup, and mobile P0 release gate expectations.

Mobile messaging/realtime parity pending remains an explicit P0 gap until the mobile implementation and real-device smoke are completed.

Mobile messaging/realtime/read-state surfaces do not expose accessToken, do not expose refreshToken, do not expose passwordHash, do not expose cookie, and do not expose authorization.

Mobile messaging/realtime parity audit permits accessToken only as an internal realtime auth input or E2E helper value; it does not expose accessToken, does not expose refreshToken, does not expose passwordHash, does not expose cookie, and does not expose authorization through response DTOs, logs, or storage.

## Mobile OTP/MFA session regression audit

Run pnpm security:mobile-auth-otp-session-regression before claiming mobile auth, OTP/MFA, refresh, or logout release readiness.

This audit covers mfa_required, OTP, refresh, logout, SecureStore, mobile P0 release gate, and API/mobile session regression expectations.

Mobile OTP/MFA/session surfaces do not expose accessToken, do not expose refreshToken, do not expose passwordHash, do not expose cookie, and do not expose authorization.

## Runtime readiness and observability coverage

Full beta critical smoke automation includes `security:runtime-readiness-observability`. This validates endpoint separation, bounded dependency probes, worker heartbeat persistence, metrics authentication, error-payload redaction, migration presence, and release wiring. It does not provision or configure an external metrics collector, dashboard, pager, Sentry project, OpenTelemetry collector, or cloud alert policy.

## Legal/KVKK public trust coverage

Full beta critical smoke automation runs `pnpm security:legal-public-trust`. It verifies legal routes, versioned terms acceptance, Google OAuth state-bound acceptance, optional analytics opt-in, mobile legal links and deployment environment requirements. It does not provide legal advice or replace final review by a qualified legal professional.
