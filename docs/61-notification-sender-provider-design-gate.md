# Notification sender provider design gate

The notification sender provider design gate defines the requirements before BabyLoop can enable any real notification delivery provider. This package is a design/readiness boundary only: it does not enable real email sending, does not enable real push sending, and does not enable real n8n workflow triggering.

Guard command:

```bash
pnpm security:notification-sender-provider-design
```

This guard is wired into:

```bash
pnpm beta:critical-smoke
```

## Current status

Current status: blocked/readiness-only.

Notification sender implementation remains blocked until explicit implementation, sandbox validation, consent enforcement, audit, observability, rollback, and manual approval.

Manual approval is required before enabling any real notification sender. Draft-only notification readiness must remain honest until provider rollout.

## Provider selection

Before implementation, choose and document providers separately:

- email provider
- push provider
- n8n workflow integration model
- queue/retry/dead-letter implementation
- staging and production secret ownership
- provider pricing/rate limits
- provider sandbox behavior
- opt-out and consent handling
- support/escalation owner

Provider selection must include fallback and disable strategy.

## Consent and preferences

Required before real sending:

- user-level notification preferences
- child/reminder-specific notification preferences
- saved-search notification preferences
- email opt-out
- push opt-out
- audit of preference changes
- blocked user/report/safety interaction rules
- rate limit per user, child, listing, and event type

No provider can send without explicit consent/preference checks.

## Delivery model

Required before real sending:

- candidate to sent/failed/skipped transition contract
- idempotency key
- retry policy
- dead-letter policy
- audit entry for send attempts
- redacted provider response storage
- no raw message body, token, email, phone, OTP, cookie, or provider secret leakage
- backoffice preview showing sender state
- rollback/kill switch

## Sandbox gate

Required sandbox evidence:

- fake recipient allowlist
- provider sandbox credentials
- no production recipient
- no production webhook
- replay-safe test payloads
- error case coverage
- retry and dead-letter dry run
- opt-out and consent denial dry run
- admin audit verification

## n8n workflow gate

n8n remains disabled until:

- signed webhook payload contract exists
- idempotency header exists
- rate limit exists
- queue worker exists
- dead-letter handling exists
- audit and observability exist
- rollback/kill switch exists
- staging sandbox workflow is reviewed

## Push sender gate

Push remains disabled until:

- native token registry exists
- token validation/revocation exists
- consent model exists
- provider sandbox exists
- retry/dead-letter exists
- audit and observability exist
- backoffice sender state is honest

## Email sender gate

Email remains disabled until:

- provider selected
- domain/authentication setup documented
- sandbox allowlist exists
- unsubscribe/opt-out is enforced
- rate limit exists
- retry/dead-letter exists
- audit and observability exist
- bounce/complaint handling is documented

## Rollback

Rollback must include:

- provider kill switch
- queue pause/drain procedure
- dead-letter replay policy
- preference enforcement verification
- previous Git SHA
- changed files list
- manual go/no-go record

## Non-goals

This gate does not send email, does not send push, does not trigger n8n workflows, does not create provider credentials, does not call webhooks, does not enqueue jobs, and does not enable production notification delivery.

## Exact guard wording

- notification sender implementation remains blocked until explicit implementation.

- manual approval is required before enabling any real notification sender.

- draft-only notification readiness must remain honest until provider rollout.

## Notification surface consistency audit

Run pnpm security:notification-consistency-audit before claiming notification release readiness.

This broad audit covers API, web, mobile, and backoffice notification surfaces. It requires deliveryAllowed=false, draftOnly=true, email/push/n8n disabled copy, notification preferences, delivery drafts, push readiness, n8n readiness, observability, and manual QA boundaries to stay aligned.

This audit does not enable real email sending, does not enable real push sending, and does not enable real n8n workflow triggering. It does not enable queues, provider calls, webhook calls, native push token collection, or production notification delivery.
