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


## Dev auth token exposure

| Variable | Required | Notes |
| --- | --- | --- |
| `BABYLOOP_EXPOSE_DEV_AUTH_TOKENS=1` | Local dev only | Allows dev-only auth helper values such as `devOtpCode`, `devResetToken`, and `devEmailVerificationToken` outside tests. Must never be set in staging or production. |

Dev auth helper values are allowed automatically only when `NODE_ENV=test`. In all other non-production environments they require `BABYLOOP_EXPOSE_DEV_AUTH_TOKENS=1`. In production they are always blocked.

## Auth secret/token leak guard

Run before staging or production deployment:

```bash
pnpm security:auth-leaks
pnpm test:api:security
```

The guard fails when generated backup/secret artifacts are present, dev auth token helper functions are duplicated, production exposure is not explicitly blocked, or sensitive auth/session/token fields are logged through `console.*`, `request.log.*`, or `app.log.*`.

This guard is intentionally conservative. If it fails, fix the source instead of bypassing it.
