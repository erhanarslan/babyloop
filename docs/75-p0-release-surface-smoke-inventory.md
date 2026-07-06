# P0 Release Surface Smoke Inventory and Gate Audit

This document normalizes the P0 release-surface smoke inventory for issues #155-#168. It is an inventory and release gate audit, not a claim that every smoke path was executed inside Codex.

Codex did not run tests for this package. The guard, docs, package scripts, and inventory references were updated statically only.

## Targeted backlog window

| Item | Status | Evidence / inventory |
| --- | --- | --- |
| #155 Mobile notification preferences real API positive/negative tests | Covered by inventory | `apps/mobile/src/features/notifications/notifications-api.test.ts`, `apps/mobile/src/features/notifications/notifications-model.test.ts`, `apps/mobile/src/features/notifications/notification-preferences-model.test.ts` |
| #156 Mobile child reminders real API positive/negative tests | Covered by inventory | `apps/mobile/src/features/child/child-reminders-api.test.ts`, `apps/mobile/src/features/child/child-reminders-model.test.ts`, `apps/mobile/src/features/child/child-reminder-screen-state-model.test.ts` |
| #157 Mobile listing create/edit/image upload release smoke | Covered by inventory | `apps/mobile/src/features/sell/sell-form-model.test.ts`, `apps/mobile/src/features/sell/image-upload-model.test.ts`, `apps/mobile/src/features/listings/my-listings-model.test.ts`, `apps/mobile/src/features/listings/listing-labels.test.ts` |
| #158 Mobile favorites/browse/listing detail smoke | Covered by inventory | `apps/mobile/src/ui/mobile-listing-card.test.ts`, `apps/mobile/src/features/listings/listing-labels.test.ts`, `apps/mobile/src/features/basket/basket-api.test.ts`, plus manual mobile smoke below |
| #159 Mobile S22 real-device smoke / Maestro retry | Deferred | Real-device S22/Maestro deferred. Device evidence is required outside Codex. `apps/mobile/.maestro/app-smoke.yaml` and `apps/mobile/.maestro/basket-assistant-smoke.yaml` stay as runbook inputs only. |
| #160 Web auth/session/CSRF aggregate release smoke | Covered by inventory | `apps/web/e2e/auth-session.smoke.spec.ts`, `apps/web/e2e/helpers/web-e2e-api.ts`, `apps/web/src/lib/auth-client.ts` |
| #161 Web messaging/favorites/listing create/browse full-flow smoke | Covered by inventory | `apps/web/e2e/messaging.smoke.spec.ts`, `apps/web/e2e/messaging-read-state.smoke.spec.ts`, `apps/web/e2e/messaging-safety.smoke.spec.ts`, `apps/web/e2e/favorites.smoke.spec.ts`, `apps/web/e2e/sell-upload.smoke.spec.ts`, `apps/web/e2e/browse.smoke.spec.ts`, `apps/web/e2e/listing-detail.smoke.spec.ts` |
| #162 Backoffice auth/RBAC/redaction/sensitive-access release smoke | Covered by inventory | `apps/backoffice/e2e/login.smoke.spec.ts`, `apps/backoffice/e2e/protected-auth-shell.smoke.spec.ts`, `apps/backoffice/src/features/shell/backoffice-shell.test.tsx`, `apps/backoffice/src/features/storage/storage-ops-page.test.tsx`, `apps/backoffice/src/features/notifications/notification-ops-page.test.tsx` |
| #163 Backoffice image review/conversation/moderation smoke aggregate | Covered by inventory | `apps/backoffice/e2e/listing-image-review.smoke.spec.ts`, `apps/backoffice/e2e/moderation-case.smoke.spec.ts`, `apps/backoffice/e2e/trust-ops.smoke.spec.ts`, `apps/backoffice/src/features/conversations/conversation-admin-list.tsx`, `apps/backoffice/src/features/conversations/conversation-admin-detail.tsx`, `apps/backoffice/src/features/listings/listing-image-review-panel.tsx` |
| #164 API security aggregate stabilization | Covered by inventory | `apps/api/test/auth.integration.test.ts`, `apps/api/test/auth-security-edge-cases.test.ts`, `apps/api/test/backoffice-csrf.test.ts`, `apps/api/test/backoffice-permissions.test.ts`, `apps/api/test/listings.integration.test.ts`, `apps/api/test/messaging.integration.test.ts`, `apps/api/test/notifications.integration.test.ts`, `apps/api/test/safety.integration.test.ts`, `apps/api/test/admin-moderation.integration.test.ts` |
| #165 Beta critical smoke duration/flake reduction | Covered by static gate | `scripts/run-beta-critical-smoke.mjs` includes the static P0 release surface smoke inventory guard before heavier steps. |
| #166 Seed/test data deterministic | Covered by inventory | `apps/api/test/helpers/db.ts`, `packages/database/src/seed.ts`, and `TEST_DATABASE_URL` run commands below. |
| #167 CI artifact/log readability pass | Covered by checklist | Log/artefact expectations below; existing `pnpm release:artifacts` remains in the beta smoke chain. |
| #168 Release blocker checklist normalized | Covered here | This file is the normalized release blocker checklist for the current P0 surface. |

## Static guard

Run:

```bash
pnpm security:p0-release-surface-smoke-inventory
```

The guard checks:

- the mobile notification, child reminder, listing, image upload, favorites/browse/detail, auth storage, and Maestro inventory paths;
- the web auth/session/CSRF, messaging, favorites, listing create, browse, listing detail, and hidden safety action inventory paths;
- the backoffice cookie auth, CSRF, RBAC/admin guard, redaction default, sensitive access reason/fields/admin/audit, image review, conversation, and moderation inventory paths;
- the API auth, listings, messaging, notifications, safety, admin moderation, image review, redaction, deterministic DB helper, and seed inventory paths;
- package scripts for `security:p0-release-surface-smoke-inventory`, `release:mobile:p0`, `test:api:security`, and `beta:critical-smoke`;
- the beta critical smoke runner includes the new static guard inside the `steps` array.

## Local command order

Run locally, outside Codex:

```bash
pnpm security:p0-release-surface-smoke-inventory
pnpm release:mobile:p0
TEST_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/babyloop_test pnpm test:api:security
pnpm beta:critical-smoke
```

Optional web/backoffice release smoke commands:

```bash
WEB_E2E_FULL_FLOW=1 WEB_E2E_BASE_URL=http://localhost:3000 WEB_E2E_API_BASE_URL=http://127.0.0.1:4000 pnpm --filter @babyloop/web exec playwright test e2e/auth-session.smoke.spec.ts e2e/browse.smoke.spec.ts e2e/favorites.smoke.spec.ts e2e/listing-detail.smoke.spec.ts e2e/messaging.smoke.spec.ts e2e/messaging-read-state.smoke.spec.ts e2e/messaging-safety.smoke.spec.ts e2e/sell-upload.smoke.spec.ts --workers=1
BACKOFFICE_E2E_BASE_URL=http://localhost:3001 pnpm --filter @babyloop/backoffice exec playwright test e2e/login.smoke.spec.ts e2e/protected-auth-shell.smoke.spec.ts e2e/listing-image-review.smoke.spec.ts e2e/moderation-case.smoke.spec.ts e2e/trust-ops.smoke.spec.ts --workers=1
```

## Real-device S22/Maestro deferred

Real-device S22/Maestro deferred means #159 and the previous #137 remain explicit manual validation items until a physical Galaxy S22 run is recorded.

Required evidence:

- device model and Android version;
- Expo/native runtime version;
- `apps/mobile/.maestro/app-smoke.yaml` result if Maestro is used;
- `apps/mobile/.maestro/basket-assistant-smoke.yaml` result if basket/assistant is covered;
- screenshots or concise notes for login, OTP/MFA, notification preferences, child reminders, sell/image upload, browse/detail/favorite, messages/realtime, basket, assistant boundary, logout;
- confirmation that no token, OTP, password, e-mail, phone, provider secret, cookie, or authorization value appears in the UI, logs, screenshots, or debug overlays.

## Release blocker checklist

- [ ] `pnpm security:p0-release-surface-smoke-inventory` passes.
- [ ] `pnpm release:mobile:p0` passes.
- [ ] `TEST_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/babyloop_test pnpm test:api:security` passes.
- [ ] `pnpm beta:critical-smoke` passes.
- [ ] Web auth/session/CSRF smoke passes with `x-babyloop-csrf-token` mutation coverage.
- [ ] Web messaging/favorites/listing create/browse smoke passes.
- [ ] Backoffice auth/RBAC/redaction/sensitive-access/image review/conversation/moderation smoke passes.
- [ ] Deterministic seed/test data is reset through the test DB helpers before API integration runs.
- [ ] CI artifact/log output is readable enough to identify the failing gate without exposing secrets.
- [ ] Real-device S22/Maestro evidence is attached before beta release.
- [ ] No provider, queue, n8n, email, push, RAG provider, or production secret path is enabled by this inventory package.

## No-leak checklist

This P0 inventory does not expose accessToken, does not expose refreshToken, does not expose passwordHash, does not expose cookie, does not expose authorization, does not expose email, does not expose phone, and does not expose raw message body in public/mobile/default backoffice DTOs, docs, storage, logs, screenshots, or CI artifacts.

Allowed internal mentions:

- auth implementation files and tests may mention accessToken/refreshToken as internal mechanics;
- test helpers may use auth headers to call protected endpoints;
- sensitive-access screens may reveal allowlisted sensitive fields only after admin auth, explicit reason, field allowlist, and audit.

Blocked surfaces:

- mobile token persistence in AsyncStorage/localStorage/sessionStorage;
- `document.cookie` access from mobile source;
- public/default backoffice DTOs with raw message body, private contact data, raw profile/user objects, auth/session internals, OTP, provider secret, webhook secret, or password hash;
- logs that include token-like values, OTP, provider secrets, raw body, e-mail, or phone values.

## Provider/queue/n8n/email/push disabled checklist

This inventory does not enable real email sending, does not enable real push sending, does not enable real n8n workflow triggering, does not enable queues, and does not enable provider calls.

Required disabled expectations:

- notification e-mail/push/n8n delivery remains draft/readiness only;
- native push token collection remains blocked;
- queue workers remain blocked;
- external provider calls remain sandboxed or unavailable unless a dedicated later release explicitly enables them;
- RAG provider rollout is not part of this package;
- real-device smoke is not marked complete by static guards.

## CI artifact and log readability expectations

- Static guard failures should print one line per missing inventory/gate item.
- Playwright/Jest/Vitest outputs should identify the spec/test file that failed.
- CI artifacts must not include `.env.local`, `.data`, raw uploaded files, provider secrets, token values, OTP values, raw message bodies, e-mail addresses, phone numbers, password hashes, cookies, or authorization headers.
- Release artifact cleanup remains guarded by `pnpm release:artifacts` and existing release artifact guards.

## Deferred items

- #159 and #137: physical Galaxy S22/Maestro real-device smoke evidence.
- Full production notification sender rollout.
- Real push/email/n8n delivery.
- Production RAG provider enablement.
- Provider-backed queues/workers.
- Additional mobile E2E automation beyond the existing `.maestro` runbook files.

## Closure note

The static inventory can close #155, #156, #157, #158, #160, #161, #162, #163, #164, #165, #166, #167, and #168 if the local commands above pass. #159 remains deferred until real-device evidence exists.
