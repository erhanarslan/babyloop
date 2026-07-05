# Notification observability taxonomy

Notification observability taxonomy defines the privacy-safe event taxonomy, metrics, dashboards, and logging boundaries required before BabyLoop enables real notification delivery. This package is readiness-only.

Guard command:

```bash
pnpm security:notification-observability-taxonomy
```

This guard is wired into:

```bash
pnpm beta:critical-smoke
```

## Current status

Current status: readiness-only.

Notification observability taxonomy does not enable metrics exporters, does not enable tracing exporters, does not enable provider calls, does not enable queue jobs, does not enable webhook calls, does not enable real email sending, does not enable real push sending, and does not enable real n8n workflow triggering.

Raw payload logging remains disabled.

## Event taxonomy

Required privacy-safe event names:

- `notification.candidate.created`
- `notification.delivery.blocked`
- `notification.delivery.skipped`
- `notification.delivery.sent`
- `notification.delivery.failed`
- `notification.preference.updated`
- `notification.readiness.previewed`
- `notification.provider.sandbox_required`
- `notification.dead_letter.recorded`
- `notification.retry.scheduled`
- `notification.click.recorded`

These names are taxonomy reservations until real provider rollout. They must not imply real sending while provider readiness remains disabled.

## Allowed dimensions

Allowed privacy-safe dimensions:

- event name
- channel
- delivery status
- notification kind
- source
- environment
- draft-only flag
- provider-enabled flag
- preference state
- age band
- reason code

## Forbidden fields

Do not log:

- email
- phone
- access token
- refresh token
- cookie
- OTP
- password
- raw message body
- raw provider response
- raw webhook payload
- authorization header
- provider secret

## Metrics

Required metrics before production notification delivery:

- `notification_candidates_total`
- `notification_blocked_total`
- `notification_skipped_total`
- `notification_provider_readiness_total`

Metrics must be PII-safe and must not include raw payload logging.

## Dashboards

Required dashboard plans:

- notification readiness and blocked delivery
- notification consent and preference outcomes
- notification retry and dead-letter outcomes
- notification click tracking outcomes

Dashboards are planned/blocked until real observability exporter implementation exists.

## Release boundary

The release gate must keep notification observability taxonomy honest:

- provider calls disabled
- queue jobs disabled
- webhook calls disabled
- metrics exporters disabled
- tracing exporters disabled
- raw payload logging disabled
- real email/push/n8n delivery disabled

Exact guard wording: raw payload logging remains disabled.
