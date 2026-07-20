# Production / Staging Environment Checklist

This checklist defines the minimum environment configuration required before BabyLoop is deployed to staging or production.

## Scope

This document is a deployment readiness checklist only. It does not enable payments, real email sending, notification delivery, n8n automation, or mobile release by itself.

Use the variable names below as the source of truth for the current codebase. Older or future-planned names such as `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `CSRF_SECRET`, `CORS_ALLOWED_ORIGINS`, `QDRANT_URL`, and `RAG_COLLECTION_NAME` are not current runtime variables unless a future config migration explicitly adds them.

## Required runtime apps

| App | Purpose | Required |
| --- | --- | --- |
| `apps/api` | Public API, auth, listings, messaging, RAG, admin API | Yes |
| `apps/web` | Public marketplace web | Yes |
| `apps/backoffice` | Admin/trust & safety operations | Yes |
| PostgreSQL | Primary relational database | Yes |
| Qdrant | RAG vector store | Required only if assistant/RAG is enabled |
| Redis | RAG cache/usage backend and realtime/queue hardening | Recommended before scale |

## Core API environment

| Variable | Required | Notes |
| --- | --- | --- |
| `NODE_ENV=production` | Production | Runtime mode |
| `PORT` | Production | API listen port |
| `API_HOST` / `HOST` | Optional | API bind host; provider may inject this |
| `DATABASE_URL` | Yes | Production PostgreSQL connection string |
| `TEST_DATABASE_URL` | CI only | Test database only; never point this at production |
| `AUTH_SECRET` | Yes | At least 32 characters; server-only |
| `AUTH_TOKEN_TTL_SECONDS` | Recommended | Default is 900 seconds |
| `AUTH_RATE_LIMIT_MAX` | Recommended | Auth endpoint rate limit max |
| `AUTH_RATE_LIMIT_WINDOW_SECONDS` | Recommended | Auth endpoint rate limit window |
| `ALLOW_AUTH_UNAVAILABLE=false` | Yes | Must not be true in staging/production |
| `WEB_APP_URL` | Yes | Public web origin for verification/reset links |
| `CORS_ORIGINS` | Yes | Comma-separated web/backoffice origins only |
| `UPLOAD_ROOT` | Local only | Local image upload root; not durable production storage |

## Public web / backoffice / mobile client environment

| Variable | App | Required | Notes |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_API_BASE_URL` | Web + backoffice | Yes | Public API base URL |
| `BABYLOOP_API_BASE_URL` | Web server-side fallback | Recommended | Server-side API base URL fallback |
| `NEXT_PUBLIC_BACKOFFICE_BASE_URL` | Web | Recommended | Backoffice link base URL |
| `NEXT_PUBLIC_SITE_URL` | Web | Yes | Metadata, canonical URLs, robots, sitemap, OpenGraph |
| `BABYLOOP_SITE_URL` | Web server-side fallback | Recommended | Server-side site URL fallback |
| `EXPO_PUBLIC_API_BASE_URL` | Mobile | Mobile builds | API base URL for Expo/React Native |

## Google OAuth

| Variable | Required | Notes |
| --- | --- | --- |
| `GOOGLE_CLIENT_ID` | If Google OAuth enabled | OAuth client id |
| `GOOGLE_CLIENT_SECRET` | If Google OAuth enabled | Secret manager only |
| `GOOGLE_REDIRECT_URI` | If Google OAuth enabled | Must match deployed API callback URL |

## Email provider

| Variable | Required | Notes |
| --- | --- | --- |
| `EMAIL_DELIVERY_MODE=noop|provider` | Yes | `noop` skips auth email delivery; `provider` routes through configured provider |
| `EMAIL_PROVIDER=mock|smtp|resend` | Yes | Provider selector |
| `EMAIL_SEND_ENABLED=false` | Yes | Kill switch; real SMTP sending requires explicit `true` |
| `EMAIL_FROM` | Provider | Required for real provider usage |
| `RESEND_API_KEY` | Resend | Secret manager only |
| `SMTP_HOST` | SMTP | SMTP host |
| `SMTP_PORT` | SMTP | Usually 465 or 587 |
| `SMTP_SECURE` | SMTP | true/false |
| `SMTP_USER` | SMTP | Secret manager only |
| `SMTP_PASS` | SMTP | Secret manager only |

Real email sending must stay disabled until delivery logging, deduplication, frequency limiting, idempotency, and admin audit are implemented for the relevant notification flows.

## Notification delivery worker

| Variable | Required | Notes |
| --- | --- | --- |
| `NOTIFICATION_PROVIDER_PROCESS_LIMIT` | Recommended | Maximum rows inspected per one-shot processor run |
| `NOTIFICATION_PROVIDER_WORKER_ID` | Optional | Stable deployment instance identifier; generated automatically when omitted |
| `NOTIFICATION_PROVIDER_CLAIM_TTL_MS` | Recommended | Claim lease in milliseconds; default 300000 and must exceed provider timeout |

Run `pnpm --filter @babyloop/api notifications:process` from exactly one scheduled job definition per deployment environment. Multiple overlapping instances are supported because every provider attempt requires an atomic database claim. Alert on expired `processing` claims, final failures and repeated stale-claim recovery.

## Image storage

| Variable | Required | Notes |
| --- | --- | --- |
| `IMAGE_STORAGE_DRIVER=local|s3` | Yes | `local` is local/dev only; use `s3` for durable staging/production uploads |
| `IMAGE_STORAGE_PUBLIC_BASE_URL` | S3/R2 | CDN/public bucket base URL |
| `S3_BUCKET` | S3/R2 | Object storage bucket |
| `S3_REGION` | S3/R2 | `auto` for Cloudflare R2 if applicable |
| `S3_ENDPOINT` | R2/custom S3 | Required for R2/custom S3-compatible providers |
| `S3_ACCESS_KEY_ID` | S3/R2 | Secret manager only |
| `S3_SECRET_ACCESS_KEY` | S3/R2 | Secret manager only |
| `S3_FORCE_PATH_STYLE` | S3/R2 optional | Usually true for R2/minio |

Production must not rely on ephemeral container disk for user-uploaded listing images.

## Listing image optimization and proxy cache

| Variable | Required | Notes |
| --- | --- | --- |
| `IMAGE_OPTIMIZATION_ENABLED` | Recommended | Enables server-side listing image normalization |
| `LISTING_IMAGE_MAX_DIMENSION` | Recommended | Default local example: 1600 |
| `LISTING_IMAGE_JPEG_QUALITY` | Recommended | Default local example: 82 |
| `LISTING_IMAGE_MIN_OPTIMIZE_BYTES` | Recommended | Skip tiny images |
| `IMAGE_PROXY_MEMORY_CACHE_ENABLED` | Optional | API memory cache for proxied S3/R2 images |
| `IMAGE_PROXY_MEMORY_CACHE_MAX_BYTES` | Optional | Total memory cache cap |
| `IMAGE_PROXY_MEMORY_CACHE_MAX_ITEM_BYTES` | Optional | Per-image memory cache cap |

## Listing image authenticity

| Variable | Required | Notes |
| --- | --- | --- |
| `LISTING_IMAGE_AUTHENTICITY_PROVIDER=gemini` | Production | `mock` is local/test only |
| `LISTING_IMAGE_AUTHENTICITY_TIMEOUT_MS` | Recommended | Model call timeout |
| `GEMINI_API_KEY` or `GOOGLE_API_KEY` | If Gemini enabled | Secret manager only |
| `GEMINI_LISTING_IMAGE_AUTHENTICITY_MODEL` | Recommended | Explicit model name |
| `GEMINI_API_ENDPOINT` | Optional | Defaults to Google Generative Language endpoint |

## AI providers

| Variable | Required | Notes |
| --- | --- | --- |
| `ASSISTANT_PROVIDER=unavailable|mock|openai|gemini` | Yes | Choose explicitly per environment |
| `AI_LISTING_DRAFT_PROVIDER=unavailable|mock|openai|gemini` | Yes | Choose explicitly per environment |
| `AI_MODERATION_SUMMARY_PROVIDER=mock|openai|gemini` | Yes | Choose explicitly per environment |
| `GEMINI_API_KEY` / `GOOGLE_API_KEY` | Gemini | Secret manager only |
| `GEMINI_ASSISTANT_MODEL` | Gemini assistant | Explicit model |
| `GEMINI_LISTING_DRAFT_MODEL` | Gemini listing draft | Explicit model |
| `GEMINI_MODERATION_SUMMARY_MODEL` | Gemini moderation summary | Explicit model |
| `OPENAI_API_KEY` | OpenAI | Secret manager only |
| `OPENAI_ASSISTANT_MODEL` | OpenAI assistant | Explicit model |
| `OPENAI_LISTING_DRAFT_MODEL` | OpenAI listing draft | Explicit model |
| `OPENAI_MODERATION_SUMMARY_MODEL` | OpenAI moderation summary | Explicit model |
| `OPENAI_RESPONSES_ENDPOINT` | OpenAI optional | Defaults to OpenAI Responses API endpoint |

## RAG / grounded assistant

| Variable | Required | Notes |
| --- | --- | --- |
| `RAG_ENABLED` | Yes | Enable/disable RAG layer |
| `RAG_VECTOR_STORE=qdrant` | If RAG enabled | Current vector store |
| `RAG_QDRANT_URL` | If RAG enabled | Qdrant endpoint |
| `RAG_QDRANT_API_KEY` | If Qdrant secured | Secret manager only |
| `RAG_QDRANT_COLLECTION` | If RAG enabled | Stable collection name |
| `RAG_QDRANT_VECTOR_SIZE` | If RAG enabled | Must match embedding model |
| `RAG_EMBEDDING_PROVIDER` | If RAG enabled | Current supported provider: Gemini |
| `RAG_EMBEDDING_MODEL` | If RAG enabled | Explicit embedding model |
| `RAG_CHAT_PROVIDER` | If RAG enabled | Current supported provider: Gemini |
| `RAG_CHAT_MODEL` | If RAG enabled | Explicit chat model |
| `RAG_REQUIRE_SOURCES=true` | Production | Assistant must not invent source-backed answers |
| `RAG_MIN_SCORE` | Recommended | Retrieval score threshold |
| `RAG_NO_SOURCE_MIN_SCORE` | Recommended | No-source fallback threshold |
| `RAG_MIN_SOURCE_COVERAGE` | Recommended | Minimum source coverage |
| `RAG_REDIS_ENABLED` | Optional | Enables Redis-backed RAG services |
| `RAG_REDIS_URL` | Redis | Required when Redis backend is selected |
| `RAG_CACHE_ENABLED` | Optional | RAG cache switch |
| `RAG_CACHE_BACKEND=memory|redis|disabled` | Optional | Prefer Redis before scale |
| `RAG_USAGE_LIMITS_ENABLED` | Recommended | RAG usage limiting |
| `RAG_USAGE_LIMITS_BACKEND=memory|redis|disabled` | Recommended | Prefer Redis before scale |
| `RAG_METRICS_ENABLED` | Recommended | Metrics counters |
| `RAG_METRICS_BACKEND=memory|redis` | Recommended | Prefer Redis before scale |
| `RAG_LIVE_EVAL_ENABLED=false` | Production default | Live eval can consume model quota |
| `RAG_PLAYGROUND_ENABLED` | Backoffice only | Admin diagnostics |
| `RAG_REINDEX_ACTION_ENABLED=false` | Production default | Keep reindex manual unless a job runner exists |

RAG must keep medical, therapy, diagnosis, treatment, diet, medication, and emergency-advice boundaries enforced.

## Assistant tool controls

| Variable | Required | Notes |
| --- | --- | --- |
| `ASSISTANT_TOOLS_ENABLED` | Optional | Enables safe read-only BabyLoop tools |
| `ASSISTANT_MAX_TOOL_CALLS` | Optional | Upper bound per answer |
| `ASSISTANT_TOOL_TIMEOUT_MS` | Optional | Tool timeout |

Assistant tools must remain read-only and public-safe.

## Notifications

| Area | Status |
| --- | --- |
| Notification preferences | Implemented |
| Saved search toggle | Implemented |
| Delivery drafts | Implemented |
| Delivery policy/dedup preview | Implemented |
| Real email/push send | Not enabled |
| n8n webhook delivery | Not enabled |
| Delivery logs | Required before real send |

Real delivery must not be enabled before delivery logs, deduplication, frequency limiting, idempotency, and admin audit are implemented.

## Backoffice production requirements

| Requirement | Status |
| --- | --- |
| Cookie auth | Required |
| CSRF-sensitive route posture | Required |
| RBAC/admin guard | Required |
| Sensitive access reason | Required |
| Audit events | Required |
| Redaction by default | Required |
| No localStorage/sessionStorage admin access tokens | Required |

## Security gates

Before production:

- HTTPS only.
- Secure cookies.
- Strict `CORS_ORIGINS` allowlist.
- `AUTH_SECRET` must be long, unique, and server-only.
- `ALLOW_AUTH_UNAVAILABLE` must be false.
- Rate limits must cover auth, messaging, upload, assistant, and admin-sensitive routes.
- No secrets in repo, logs, URLs, browser storage, or client bundles.
- Upload accepts only safe image types with content validation.
- Public DTOs must not expose seller email, phone, user id, tokens, raw profile/user objects, or private child profile data.

## Deployment blockers

Production is blocked if any of these are true:

- `.env.local`, `.data`, Qdrant local data, `.DS_Store`, generated reports, or secrets are tracked by git.
- User uploaded images depend on ephemeral container disk.
- `IMAGE_STORAGE_DRIVER=local` is used for real user uploads.
- `ALLOW_AUTH_UNAVAILABLE=true`.
- `LISTING_IMAGE_AUTHENTICITY_PROVIDER=mock` or unavailable in production.
- Backoffice auth stores tokens in browser-readable storage.
- RAG answers can provide diagnosis, medication, treatment, diet plan, or therapy claims.
- Notification real delivery is enabled without delivery logs, deduplication, frequency limits, idempotency, and admin audit.
- Payment/checkout is enabled without dedicated payment audit, webhook verification, and legal review.

## Email provider

| Variable | Required | Notes |
| --- | --- | --- |
| `EMAIL_DELIVERY_MODE=noop|provider` | Yes | `noop` skips auth email delivery; `provider` routes through configured provider |
| `EMAIL_PROVIDER=mock|smtp|resend` | Yes | `mock` never sends real email |
| `EMAIL_SEND_ENABLED=true|false` | Yes | Must remain false until provider is configured and tested |
| `EMAIL_FROM` | Required for `smtp` or `resend` | Sender identity |
| `SMTP_HOST`, `SMTP_PORT` | SMTP only | Required when `EMAIL_PROVIDER=smtp` |
| `SMTP_USER`, `SMTP_PASS` | SMTP send only | Required when `EMAIL_PROVIDER=smtp` and `EMAIL_SEND_ENABLED=true` |
| `SMTP_SECURE` | SMTP only | Defaults to true when omitted |
| `RESEND_API_KEY` | Resend send only | Required when `EMAIL_PROVIDER=resend` and `EMAIL_SEND_ENABLED=true` |

`EMAIL_SEND_ENABLED=true` is supported only with `EMAIL_PROVIDER=smtp` or `EMAIL_PROVIDER=resend`.
Provider previews and admin email ops must never return SMTP credentials, Resend API keys, auth tokens, reset tokens, verification tokens, or OTP codes.

### Marketplace notification email

Message and listing-favorite email delivery uses its own preference-aware worker
boundary. Production requires `NOTIFICATION_EMAIL_ENABLED=true`,
`NOTIFICATION_EMAIL_PROVIDER=resend`, `RESEND_FROM_EMAIL`, `RESEND_API_KEY`, and a
scheduled `pnpm --filter @babyloop/api notifications:process` job. Keep
`RESEND_API_BASE_URL=https://api.resend.com`; the provider appends `/emails`.

Cloudflare R2, marketplace email, and listing-image policy activation steps are in
`docs/57-r2-marketplace-email-image-policy-runbook.md`.


## Dev auth token exposure

| Variable | Required | Notes |
| --- | --- | --- |
| `BABYLOOP_EXPOSE_DEV_AUTH_TOKENS=1` | Local dev only | Allows dev-only auth helper values such as `devOtpCode`, `devResetToken`, and `devEmailVerificationToken` outside tests. Must never be set in staging or production. |

Dev auth helper values are allowed automatically only when `NODE_ENV=test`. In all other non-production environments they require `BABYLOOP_EXPOSE_DEV_AUTH_TOKENS=1`. In production they are always blocked.

## Auth secret/token leak guard

Run before staging or production deployment. This guard also verifies MIME/magic-byte validation, S3/R2 credential boundaries, duplicate image hash coverage, and metadata-stripping image normalization:

```bash
pnpm security:auth-leaks
pnpm test:api:security
```

The guard fails when generated backup/secret artifacts are present, dev auth token helper functions are duplicated, production exposure is not explicitly blocked, or sensitive auth/session/token fields are logged through `console.*`, `request.log.*`, or `app.log.*`.

This guard is intentionally conservative. If it fails, fix the source instead of bypassing it.


## Image storage security guard

Run before staging or production deployment. This guard also verifies MIME/magic-byte validation, S3/R2 credential boundaries, duplicate image hash coverage, and metadata-stripping image normalization:

```bash
pnpm security:image-storage
pnpm test:api:security
```

The guard fails when:

- S3/R2 storage config support is missing,
- production readiness no longer rejects local disk uploads,
- storage ops preview risks exposing credentials,
- image safety/optimization foundations disappear,
- storage secrets are logged,
- stale docs claim S3/R2 storage is still only future work.

Remaining product hardening after this guard: dedicated upload frequency/quota controls, real fraud scoring for cross-listing duplicate images, broader image moderation policy tuning, appeal workflows, and perceptual duplicate detection.

- `apps/api/test/image-storage-s3-contract.test.ts` must pass before enabling S3/R2 uploads outside local development.

## Mobile notification boundary

The mobile notification surface remains draft-only for email/push/n8n delivery claims; in-app notification reads and preference previews do not enable external delivery.

`pnpm security:mobile-notifications` must pass before mobile P0 or beta claims include notification functionality.

Current mobile notification scope is in-app/read/unread/preferences only. Email/push/n8n delivery remains blocked by the existing delivery policy until delivery logs, deduplication, frequency limiting, idempotency, and admin audit are implemented.

This checklist does not enable native push tokens, Expo push delivery, email notification delivery, n8n webhooks, queues, or background workers.

## Notification delivery log foundation

`notification_delivery_logs` exists as the idempotency and frequency window foundation for future notification delivery.

Production readiness still requires:

- `pnpm security:notification-delivery-log` passing,
- sender-specific delivery result transitions,
- retry/failure policy,
- admin audit for real sends,
- provider sandbox validation.

The foundation records candidate logs with `deliveryAllowed=false` and `draftOnly=true`; it does not enable email/push/n8n delivery.

## Notification delivery-log ops preview

Production readiness includes a backoffice notification delivery-log ops preview. The preview is aggregate and redacted: it can show counts by status/kind/channel and recent redacted source refs, but must not expose metadata, idempotency key, dedup key, e-mail, token, cookie, authorization, or raw body values.

This preview does not enable email/push/n8n delivery. `pnpm security:notification-ops-preview` must pass before release smoke.

## Notification delivery transition model

Production readiness requires an explicit notification delivery transition model before real sender rollout. Current allowed transitions are draft-only candidate/block/skip flows. `sent/failed` transitions must remain blocked until provider sandbox, retry/dead-letter policy, idempotency enforcement, and admin audit exist.

`pnpm security:notification-delivery-transitions` must pass before release smoke. The model must not enable email/push/n8n senders, queues, webhooks, or provider calls.

## Native push readiness

Production readiness requires native push readiness to remain blocked until token registry, device consent, platform token validation/revocation, provider sandbox, retry/dead-letter policy, admin audit, rate limits, and delivery transition enforcement exist.

`pnpm security:notification-push-readiness` must pass before release smoke. The preview must not enable Expo/Firebase/APNs provider calls, queues, n8n hooks, webhooks, token collection, or push sender delivery.

## n8n workflow readiness

Production readiness requires n8n workflow readiness to remain blocked until webhook contract, idempotency header, signed payload, queue/worker, retry/dead-letter policy, admin audit, rate limits, consent, and delivery transition enforcement exist.

`pnpm security:notification-n8n-readiness` must pass before release smoke. The preview must not enable n8n webhooks, queue workers, provider calls, email, push, or real workflow delivery.

## Mobile real-device S22 QA

Production readiness requires a physical Galaxy S22 QA pass before beta. `pnpm qa:mobile:s22` must pass and `docs/56-mobile-real-device-s22-qa-checklist.md` must be completed.

The run must cover OTP/MFA, auth/session, browse/listing detail, sell listing with camera/gallery upload, favorites, messaging/realtime reconnect, reports/block, child profile/reminder entry points, Android bottom tab safe-area behavior, and privacy/log leakage. Push sender disabled and n8n workflow disabled copy must remain accurate until real senders are implemented.

## Storage ops preview

Production readiness requires storage ops preview to remain local-only until provider selection, private bucket policy, signed upload contract, EXIF stripping, lifecycle cleanup, admin audit, CDN cache policy, and local-to-object-storage migration replay plan exist.

`pnpm security:storage-ops-preview` must pass before release smoke. External storage provider disabled must remain true until real S3/R2 rollout is explicitly implemented. Signed upload, bucket delete, object copy, CDN purge, and queue worker must stay disabled in this preview.

## Full beta critical smoke automation

Production/beta readiness requires `pnpm security:beta-critical-smoke` and `pnpm beta:critical-smoke` to pass.

Full beta critical smoke automation collects assistant safety guard, storage ops preview, mobile real-device S22 QA, notification readiness, `security:auth-leaks`, `release:artifacts`, and API/backoffice/web/mobile typechecks. It does not replace manual physical Galaxy S22 QA evidence.

The gate must not enable push sender, n8n workflow, S3/R2 external storage, autonomous RAG answers, provider calls, webhook calls, queue workers, or production secrets.

## Deployment readiness gate

Production/beta readiness requires `pnpm security:deployment-readiness` and `pnpm beta:critical-smoke` to pass.

Deployment readiness gate covers staging and production environment variables, secrets, database migration, rollback, observability, health checks, CORS/cookie/CSRF environment configuration, and manual go/no-go approval.

This gate does not deploy, does not create cloud resources, and does not enable AWS, Kubernetes, S3/R2, Redis, n8n, push, email, payment, or production database access. Staging/prod deploy remains blocked until explicit implementation.

## Public auth cookie migration

Production/beta readiness requires `pnpm security:public-auth-cookie-migration` and `pnpm beta:critical-smoke` to pass before any public auth runtime migration.

Public auth cookie migration planning must document httpOnly, sameSite, secure cookie, CSRF, refresh token, logout, session refresh, CORS, protected routes, MFA/OTP, manual QA, and rollback.

This gate does not change runtime auth behavior and must not store access tokens in browser storage or expose refresh tokens to JavaScript.

## Notification sender provider design gate

Production/beta readiness requires `pnpm security:notification-sender-provider-design` and `pnpm beta:critical-smoke` to pass before any real notification sender rollout.

Notification sender provider design gate covers provider selection, sandbox, consent, rate limit, retry, dead-letter, audit, observability, rollback, email provider readiness, push provider readiness, and n8n workflow readiness.

This gate does not enable real email sending, real push sending, real n8n workflow triggering, provider credentials, webhook calls, queue jobs, or production notification delivery.

## Notification observability taxonomy

Production/beta readiness requires `pnpm security:notification-observability-taxonomy` and `pnpm beta:critical-smoke` to pass before real notification delivery.

Notification observability taxonomy covers event taxonomy, privacy-safe dimensions, metrics, dashboard plans, raw payload logging boundary, PII restrictions, retry/dead-letter observability, preference observability, and click tracking readiness.

This gate does not enable metrics exporters, tracing exporters, provider calls, queue jobs, webhook calls, real email sending, real push sending, or real n8n workflow triggering.

## Notification consent/preference policy

Production/beta readiness requires `pnpm security:notification-consent-preference` and `pnpm beta:critical-smoke` to pass before any real notification delivery.

Notification consent/preference policy covers consent, preference, opt-out, audit, rate limit, blocked user safety, mute/snooze windows, source/channel scopes, privacy boundaries, and raw contact logging.

This gate does not enable real email sending, real push sending, real n8n workflow triggering, provider calls, queue jobs, webhook calls, or unconsented delivery.

## Mobile OTP/MFA hardening

Production/beta readiness requires `pnpm security:mobile-otp-mfa-hardening` and `pnpm beta:critical-smoke` to pass before mobile auth runtime changes.

Mobile OTP/MFA hardening covers SecureStore, OTP, MFA, rate limit, session refresh, logout cleanup, protected route return, network recovery, invalid/expired code states, resend cooldown, and Galaxy S22 QA evidence.

This gate does not change runtime auth behavior, does not enable SMS OTP, does not enable authenticator MFA, and does not enable push security notification.

## Child notebook/reminder hardening

Production/beta readiness requires `pnpm security:child-notebook-reminder-hardening` and `pnpm beta:critical-smoke` to pass before marking child notebook/reminder complete.

Child notebook/reminder hardening covers free note, recurring reminder, advance reminder, every 2 hours feeding reminder, notification preference, web child notebook, mobile child notebook, complete/cancel/snooze, owner-only access, inactive child profile handling, and no medical/therapy/diagnosis/drug/diet advice.

This gate does not create runtime CRUD, schedule queue jobs, send notifications, call providers, or trigger n8n.

## Notification preference QA

Production/beta readiness requires `pnpm security:notification-preference-qa` and `pnpm beta:critical-smoke` to pass before marking notification preferences complete.

Notification preference QA covers backoffice notification preferences, mobile notification preferences, web notification preferences, opt-out, audit, rate limit, blocked user safety, raw contact logging, and manual QA evidence.

This gate does not enable real sending, provider calls, queue jobs, or webhook calls.

## Beta smoke Mobile P0 release gate

Production/beta readiness requires full beta critical smoke automation to include `pnpm release:mobile:p0` as the deterministic device-free Mobile P0 release gate. It covers mobile auth, mobile notification boundary, mobile P0 Jest tests, and mobile typecheck.

This does not run Maestro or require ADB, does not start Expo, and does not replace manual physical Galaxy S22 QA evidence.

## Child reminder API scheduling boundary

Production/beta readiness requires `pnpm security:child-reminder-api-schedule` to pass before child reminder scheduling is claimed complete.

The boundary enforces `reminder_not_due`, `reminder_invalid_date`, draft-only candidate logs, and notification consent/preference prerequisites. It does not run queue jobs, does not send email, does not send push, and does not trigger n8n.

## Image upload/review storage boundary

Production/beta readiness requires pnpm security:image-upload-review-storage.

This boundary verifies that image upload/review responses do not expose objectKey, filePath, contentHash, raw provider output, raw upload body, base64 image data, credentials, tokens, cookies, storageDriver, uploadRoot, or local absolute paths.

It does not enable S3/R2 rollout, signed upload, bucket mutation, CDN purge, or queue workers.

Image upload/review storage boundary does not expose objectKey, does not expose filePath, and does not expose contentHash in public or admin API responses.

## Notification surface consistency audit

Run pnpm security:notification-consistency-audit before claiming notification release readiness.

This broad audit covers API, web, mobile, and backoffice notification surfaces. It requires deliveryAllowed=false, draftOnly=true, email/push/n8n disabled copy, notification preferences, delivery drafts, push readiness, n8n readiness, observability, and manual QA boundaries to stay aligned.

This audit does not enable real email sending, does not enable real push sending, and does not enable real n8n workflow triggering. It does not enable queues, provider calls, webhook calls, native push token collection, or production notification delivery.

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

## Mobile AI/RAG/listing boundary

Production/beta readiness requires `pnpm security:mobile-ai-rag-listing`, targeted mobile Jest tests, targeted assistant/listing draft API tests, and `pnpm release:mobile:p0` to pass before claiming the mobile assistant or visual listing draft flow complete.

This boundary covers:

- backoffice auth bootstrap request dedupe without weakening 401/403 auth protection;
- native child reminder date/time picker binding through `@react-native-community/datetimepicker`;
- mobile assistant parsing of `mode`, `grounded`, safe sources, tool previews, and safe internal suggested actions from `/api/v1/assistant/messages`;
- mobile visual listing draft generation through `/api/v1/listings/ai-draft-suggestions`;
- user-approved, non-blocking AI draft merge that preserves existing title, description, category, price, condition, and listing type unless the relevant field is empty.

This boundary does not claim physical Galaxy S22 QA, does not auto-publish listings, does not guarantee product safety, does not expose raw source paths/base64/provider output/prompts/API keys/tokens/cookies/authorization, and does not soften medical/therapy/diagnosis/drug/diet refusal rules.

## Web P0 feature completion boundary

Production/beta readiness for the web P0 surfaces requires `pnpm security:web-p0-feature-completion`, targeted web tests, web typecheck, and manual browser QA before claiming completion.

This boundary covers:

- cookie session restore without refresh storms;
- MFA OTP challenge continuation through the real auth API;
- Assistant source/mode/grounding display with unsafe suggested-action href rejection;
- visual listing draft suggestions through `/api/v1/listings/ai-draft-suggestions` with user-approved empty-field merge only;
- child notebook/reminder real-data rendering and API-compatible schedule forms.

This boundary does not claim trusted-device management if no backend feature exists, does not guarantee AI product identification or product safety, does not auto-publish listings, does not soften medical/therapy/diagnosis/drug/diet boundaries, and does not replace manual browser QA.

## RAG retrieval and grounding boundary

Production readiness for assistant retrieval requires:

- `pnpm security:rag-research-corpus`
- `pnpm security:assistant-safety-guard`
- `pnpm security:rag-retrieval-grounding`
- `pnpm test:rag:retrieval`
- `pnpm test:rag:eval`
- `pnpm release:rag`

The retrieval boundary verifies domain routing, canonical answer ownership, metadata-constrained retrieval, cross-domain contamination rejection, grounding validation, cache versioning and 150+ eval cases. It does not claim live provider quality unless `RAG_LIVE_EVAL_ENABLED=true` is explicitly run, and it does not mutate production Qdrant collections.

## Product analytics privacy boundary

Production/beta readiness for first-party product analytics requires:

- `pnpm security:product-analytics-privacy`
- `pnpm release:analytics`

Product analytics is first-party usage measurement only. It must stay separate from admin/security audit logs and operational observability. Analytics tables must not contain passwords, tokens, cookies, authorization headers, exact IP addresses, raw query strings, message bodies, child note/reminder bodies, assistant prompts, listing descriptions, image base64, signed URLs, raw RAG source text, or provider raw output.

Backoffice analytics should read aggregate metrics by default. Current-state metrics such as verified users and Google-linked users must come from database state (`emailVerifiedAt` and provider/account relations), not only from client-side event counts. Raw events and aggregate retention must remain configurable, and analytics failures must not block user-facing business flows.

## Runtime readiness and observability

Production requires separate liveness and readiness probes:

- `/health/live` for process liveness,
- `/health/ready` for PostgreSQL, schema, storage, RAG dependency, worker heartbeat, and stale-claim readiness,
- `/internal/metrics` for bearer-protected Prometheus scraping.

Required production posture:

```text
OBSERVABILITY_METRICS_ENABLED=true
OBSERVABILITY_METRICS_TOKEN=<long-random-secret>
OBSERVABILITY_ERROR_WEBHOOK_URL=https://...
HEALTH_REQUIRE_NOTIFICATION_WORKER=true
HEALTH_REQUIRE_CHILD_REMINDER_WORKER=true
HEALTH_FAIL_ON_STALE_NOTIFICATION_CLAIMS=true
```

`pnpm security:runtime-readiness-observability` and `pnpm test:api:readiness` must pass. Database migration `0043_runtime_readiness_observability` must be applied before enabling required worker readiness.

## Backup, restore, and rollback environment

- `BACKUP_ENVIRONMENT=production`
- `BACKUP_OUTPUT_DIR` points to a restricted primary backup directory.
- `BACKUP_REPLICA_DIR` points to a separate persistent mounted volume or backup sink.
- `BACKUP_ENCRYPTION_MODE=age`
- `BACKUP_AGE_RECIPIENT` contains only the public age recipient.
- `BACKUP_AGE_IDENTITY_FILE` is supplied only to controlled restore jobs through secret management.
- `BACKUP_RETENTION_DAYS` and `BACKUP_RETENTION_COUNT` are explicit positive integers.
- `BACKUP_RESTORE_SMOKE_EVIDENCE` records the most recent isolated restore proof.
- `RELEASE_BACKUP_MANIFEST_PATH` identifies the verified pre-deploy backup manifest.
- `RELEASE_DATABASE_FORWARD_COMPATIBLE` is explicitly reviewed for each migration-bearing release.
- Real backup artifacts, manifests, restore receipts, age private identities, and release manifests are not committed.
