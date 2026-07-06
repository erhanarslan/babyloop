# Notification surface consistency audit

Notification surface consistency audit is the broad release boundary for notification API, web, mobile, and backoffice surfaces.

Run:

pnpm security:notification-consistency-audit

This audit verifies:

- API notification routes expose in-app notification list/read/unread/read-all and delivery-draft previews without enabling external delivery.
- Web notification preferences and notification list surfaces use the same draft-only/no-real-delivery contract.
- Mobile notifications, notification preferences, and child reminder surfaces keep external delivery disabled.
- Backoffice notification ops preview remains an operational preview, not a sender.
- Delivery policy keeps deliveryAllowed=false and draftOnly=true.
- Delivery logs keep idempotency, dedup, frequency window, and safe metadata boundaries.
- Push readiness remains blocked until token registry, provider sandbox, consent, retry/dead-letter, rate limit, and audit are implemented.
- n8n readiness remains blocked until webhook contract, signature, queue worker, retry/dead-letter, consent, rate limit, and audit are implemented.
- Observability taxonomy remains readiness-only and does not allow raw payload, PII, token, cookie, OTP, raw provider response, or raw webhook logging.
- Notification preference QA remains required across API, web, mobile, and backoffice.

The audit is deliberately draft-only. It does not enable real email sending, does not enable real push sending, does not enable real n8n workflow triggering, does not enable queues, does not collect native push tokens, does not call providers, does not call webhooks, and does not mutate delivery sender state.

Required release guarantees:

- deliveryAllowed=false remains visible in policy and ops surfaces.
- draftOnly=true remains visible in policy, draft, log, and ops surfaces.
- email/push/n8n delivery claims stay disabled until the dedicated delivery implementation package.
- Notification DTOs and metadata do not expose raw email, phone, accessToken, refreshToken, passwordHash, cookie, authorization, OTP, provider secrets, raw provider output, raw webhook payload, or raw message body.

Notification surface consistency audit explicitly covers delivery drafts and manual QA across API, web, mobile, and backoffice surfaces.
