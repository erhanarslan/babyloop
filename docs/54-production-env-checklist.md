# Production / Staging Environment Checklist

This checklist defines the minimum environment configuration required before BabyLoop is deployed to staging or production.

## Scope

This document is a deployment readiness checklist only. It does not enable payments, real email sending, notification delivery, n8n automation, or mobile release by itself.

## Required runtime apps

| App | Purpose | Required |
| --- | --- | --- |
| `apps/api` | Public API, auth, listings, messaging, RAG, admin API | Yes |
| `apps/web` | Public marketplace web | Yes |
| `apps/backoffice` | Admin/trust & safety operations | Yes |
| PostgreSQL | Primary relational database | Yes |
| Qdrant | RAG vector store | Required if assistant/RAG enabled |
| Redis | Queue/session/rate-limit future hardening | Recommended before scale |

## Core environment

| Variable | Required | Notes |
| --- | --- | --- |
| `NODE_ENV=production` | Yes | Production runtime mode |
| `DATABASE_URL` | Yes | Production PostgreSQL |
| `TEST_DATABASE_URL` | CI only | Test database only |
| `API_BASE_URL` | Yes | Internal/public API base if used |
| `NEXT_PUBLIC_API_BASE_URL` | Yes | Used by web/backoffice clients |
| `PUBLIC_WEB_ORIGIN` | Yes | Public web origin |
| `BACKOFFICE_ORIGIN` | Yes | Backoffice origin |
| `CORS_ALLOWED_ORIGINS` | Yes | Must include web/backoffice origins only |

## Auth and session

| Variable | Required | Notes |
| --- | --- | --- |
| `JWT_ACCESS_SECRET` | Yes | Strong unique production secret |
| `JWT_REFRESH_SECRET` | Yes | Strong unique production secret |
| `COOKIE_DOMAIN` | Production | Must match deployed domain strategy |
| `COOKIE_SECURE=true` | Production | Required over HTTPS |
| `CSRF_SECRET` | Yes | Public/backoffice CSRF protection |
| `GOOGLE_CLIENT_ID` | Optional | Required only if Google OAuth enabled |
| `GOOGLE_CLIENT_SECRET` | Optional | Never expose to client |

## Image storage

| Variable | Required | Notes |
| --- | --- | --- |
| `IMAGE_STORAGE_DRIVER=local|s3` | Yes | `local` only for local/dev or temporary staging |
| `IMAGE_STORAGE_PUBLIC_BASE_URL` | S3/R2 | CDN/public bucket base URL |
| `S3_BUCKET` | S3/R2 | Object storage bucket |
| `S3_REGION` | S3/R2 | `auto` for Cloudflare R2 if applicable |
| `S3_ENDPOINT` | S3/R2 optional | Required for R2/custom S3-compatible providers |
| `S3_ACCESS_KEY_ID` | S3/R2 | Secret manager only |
| `S3_SECRET_ACCESS_KEY` | S3/R2 | Secret manager only |
| `S3_FORCE_PATH_STYLE` | S3/R2 optional | Usually true for R2/minio |

Production must not rely on local container disk for user-uploaded listing images.

## Email provider

| Variable | Required | Notes |
| --- | --- | --- |
| `EMAIL_PROVIDER=mock|smtp|resend` | Yes | Current foundation keeps sending disabled |
| `EMAIL_FROM` | Provider | Required for SMTP/Resend |
| `RESEND_API_KEY` | Resend | Secret manager only |
| `SMTP_HOST` | SMTP | SMTP host |
| `SMTP_PORT` | SMTP | Usually 465 or 587 |
| `SMTP_SECURE` | SMTP | true/false |
| `SMTP_USER` | SMTP | Secret manager only |
| `SMTP_PASS` | SMTP | Secret manager only |

Email provider foundation is currently sandbox-only. Real send enablement must be a separate controlled release.

## RAG / assistant

| Variable | Required | Notes |
| --- | --- | --- |
| `ASSISTANT_PROVIDER` | Optional | Depends on provider implementation |
| `GEMINI_API_KEY` | If Gemini enabled | Secret manager only |
| `QDRANT_URL` | If RAG enabled | Qdrant endpoint |
| `QDRANT_API_KEY` | If Qdrant secured | Secret manager only |
| `RAG_COLLECTION_NAME` | Recommended | Stable collection name |
| `RAG_ENABLE_CACHE` | Optional | Cache behavior |
| `RAG_ENABLE_USAGE_METRICS` | Optional | Usage metrics behavior |

RAG must keep medical/therapy/diagnosis/treatment/diet boundaries enforced.

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

Real delivery must not be enabled before delivery logs, dedup, frequency limiting, idempotency, and admin audit are implemented.

## Backoffice

| Requirement | Status |
| --- | --- |
| Cookie auth | Required |
| CSRF | Required |
| RBAC/admin guard | Required |
| Sensitive access reason | Required |
| Audit events | Required |
| Redaction by default | Required |
| No localStorage/sessionStorage tokens | Required |

## Security gates

Before production:

- HTTPS only.
- Secure cookies.
- Strict CORS allowlist.
- CSRF enforced.
- Rate limits enabled on auth, messaging, upload, assistant, and admin-sensitive routes.
- No secrets in repo, logs, URLs, browser storage, or client bundles.
- Upload accepts only JPEG/PNG/WebP with magic-byte validation.
- Public DTOs must not expose seller email, phone, user id, tokens, raw profile/user objects, or private child profile data.

## Deployment blockers

Production is blocked if any of these are true:

- `.env.local`, `.data`, Qdrant local data, or secrets are tracked by git.
- User uploaded images depend on ephemeral container disk.
- Backoffice auth stores tokens in browser-readable storage.
- RAG answers can provide diagnosis, medication, treatment, diet plan, or therapy claims.
- Notification real delivery is enabled without delivery logs/dedup/frequency/idempotency.
- Payment/checkout is enabled without a dedicated payment audit and legal review.
