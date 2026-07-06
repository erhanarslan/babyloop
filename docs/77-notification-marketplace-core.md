# Notification Delivery Sandbox + Marketplace Core

This release gate covers backlog items #193-#223. Codex did not run tests in this task; local validation commands are listed below.

## Implemented In Code

- #193 Notification preference per source/channel storage: DB-backed `notification_preferences` with source/channel allowlists.
- #194 Notification preference audit trail: DB-backed `notification_preference_audit_events` with redacted reason text and no raw contact fields.
- #198 Notification delivery provider design gate sonrası sandbox: provider delivery remains disabled by default.
- #199 Email draft/provider adapter boundary: email remains draft/readiness-only; no sender is enabled.
- #200 Push token registry design gate: hash-only push token registry/API can exist; native token collection and sender activation remain disabled in this package.
- #201 Push readiness real mobile integration hazırlığı: mobile has API/model readiness, not native push delivery.
- #202 n8n webhook contract design: n8n is represented as a disabled channel; no webhook call is enabled.
- #203 n8n sandbox workflow boundary: dry-run/readiness only; no queue or worker is enabled.
- #204 Saved searches web UI: list, delete, notification toggle, loading/empty/error states already exist.
- #205 Saved searches API negative/security tests: auth, invalid body, owner-only, unknown-field, no-leak coverage exists.
- #206 Seller dashboard foundation: API and web page exist with aggregate counts only.
- #207 Seller listing status management UX: seller dashboard and listing status surfaces are covered by existing inventory.
- #208 Listing archive/restore/sold/reserved UX consistency: status transition inventory remains guarded.
- #209 Listing edit form hardening: owner-only and unknown-field inventory remains guarded.
- #210 Listing image reorder/delete web UX polish sonrası tests: image management test inventory remains guarded.
- #211 Listing image review public/admin consistency extra E2E inventory: public/admin review surfaces remain guarded.
- #212 Browse filters mobile/web consistency: browse routing and UI inventory remains guarded.
- #213 Search result sorting/pagination regression: sort/offset/pagination coverage remains guarded.
- #214 Location/city filter dynamic source: city/location option inventory remains guarded.
- #215 Category landing SEO/data consistency: category page/data inventory remains guarded.
- #216 Favorites empty/error/loading states: favorites state inventory remains guarded.
- #217 Favorites mobile integration: mobile favorites API/screen inventory remains guarded.
- #218 Messaging unread/read state web/mobile consistency: web/mobile read-state inventory remains guarded.
- #219 Conversation notification/read reconciliation: read-state notification reconciliation inventory exists.
- #220 Report/block hidden menu expectation: guard checks safety action and messaging hidden/secondary surface inventory.
- #221 Public seller profile safe summary page: `/api/v1/profiles/:profileId` and `/profiles/:profileId` expose safe summary only.
- #222 Profile safety status user-facing behavior: public profile exposes safe status labels only, not internal enforcement reasons.
- #223 Product analytics event consistency: seller dashboard and product-events routes remain event/aggregate based without PII payloads.

## Provider / Queue Boundary

The package intentionally does not enable:

- Real email send.
- Real push send or raw push token collection.
- Real n8n webhook execution.
- Real SMS send.
- Real queue worker.
- Real payment/Iyzico changes.
- Real production S3/R2 migration.

Notification preference channels are `in_app`, `email`, `push`, and `n8n`. `in_app` may be enabled by preference. `email`, `push`, and `n8n` remain draft/sandbox/readiness-only unless a future provider gate explicitly enables delivery.

No real n8n webhook execution.
No real push send.
No real email send.
No real SMS send.

## Provider Execution Layer

BabyLoop now has an env-gated notification provider execution layer on top of `notification_delivery_logs`. Missing env keeps delivery safe as `provider_disabled` / `skipped` and no network call is made.

Provider env vars:

- n8n: `N8N_NOTIFICATION_WEBHOOK_ENABLED`, `N8N_NOTIFICATION_WEBHOOK_URL`, `N8N_NOTIFICATION_WEBHOOK_BEARER_TOKEN`, `N8N_NOTIFICATION_WEBHOOK_SECRET`, `N8N_NOTIFICATION_WEBHOOK_TIMEOUT_MS`, `N8N_NOTIFICATION_WEBHOOK_MAX_RETRIES`
- Resend: `NOTIFICATION_EMAIL_ENABLED`, `NOTIFICATION_EMAIL_PROVIDER=resend`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `RESEND_FROM_NAME`, `RESEND_API_BASE_URL`, `NOTIFICATION_EMAIL_TIMEOUT_MS`, `NOTIFICATION_EMAIL_MAX_RETRIES`
- Push: `NOTIFICATION_PUSH_ENABLED`, `PUSH_PROVIDER=expo`, `EXPO_ACCESS_TOKEN`, `EXPO_PUSH_API_BASE_URL`, `NOTIFICATION_PUSH_TIMEOUT_MS`, `NOTIFICATION_PUSH_MAX_RETRIES`, `PUSH_TOKEN_ENCRYPTION_KEY`

Delivery lifecycle:

- `candidate` logs are processed by `pnpm --filter @babyloop/api notifications:process`.
- Preference/consent gates run before provider calls.
- Provider env missing: `skipped` with `skippedReason=provider_disabled`.
- Success: `sent`, `providerStatus=sent`, redacted `providerMessageId`, `sentAt`, `deliveredAt`.
- Retryable provider/network failure: `failed`, `providerStatus=retry_scheduled`, `attemptCount`, `lastAttemptAt`, `nextAttemptAt`.
- Non-retryable provider rejection: `failed` with redacted error code/message.
- Idempotency uses the delivery log idempotency key and provider headers.

PII/redaction policy:

- n8n payload allowlist: event type, source, channel, delivery log id, idempotency key, profile/source ids, child/reminder ids, schedule metadata, short sanitized title and timestamps.
- Resend payload includes only the verified recipient email required for delivery plus sanitized subject/text/html.
- Push payload includes token only in the provider request, never in logs/DTOs; stored push tokens are hash-only plus encrypted envelope when `PUSH_TOKEN_ENCRYPTION_KEY` or `AUTH_SECRET` is configured.
- Admin monitor shows provider/status/attempt/error summary only. It does not expose metadata, idempotency keys, e-mail, raw push token, provider secret, webhook secret, raw body, API key, cookie or authorization header.

## No-Leak Checklist

- Public and admin default DTOs must not expose `accessToken`, `refreshToken`, `passwordHash`, cookies, authorization headers, OTP, provider secrets, webhook secrets, raw emails, raw phone numbers, raw message bodies, or raw push tokens.
- Notification preference audit reasons are plaintext-normalized and contact-redacted.
- Internal auth test helpers may contain access tokens for request setup; that is not a leak unless values are persisted, logged, or returned in public/admin DTOs.
- Mobile token persistence must remain SecureStore-based; AsyncStorage/localStorage/sessionStorage token persistence is forbidden.
- Public report/block actions stay behind safety/secondary menu patterns.
- SQL sort/filter/pagination remains allowlist/query-builder based.

## Local Commands

```bash
pnpm security:notification-marketplace-core
pnpm release:mobile:p0
TEST_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/babyloop_test pnpm test:api:security
pnpm beta:critical-smoke
```

Optional targeted checks:

```bash
TEST_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/babyloop_test pnpm --filter @babyloop/api exec vitest run --config vitest.config.ts test/notification-preferences.routes.test.ts test/public-profiles.routes.test.ts test/saved-searches.routes.test.ts test/seller-dashboard.routes.test.ts
pnpm --filter @babyloop/mobile exec jest --runInBand --runTestsByPath src/features/notifications/notification-preferences-model.test.ts src/features/favorites/favorites-api.test.ts src/features/listings/listing-labels.test.ts
```
