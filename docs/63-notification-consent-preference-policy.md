# Notification consent/preference policy

Notification consent/preference policy defines the readiness boundary before BabyLoop enables any real notification delivery. This package is readiness-only.

Guard command:

```bash
pnpm security:notification-consent-preference
```

This guard is wired into:

```bash
pnpm beta:critical-smoke
```

## Current status

Current status: readiness-only.

Real notification delivery remains blocked until explicit implementation, consent checks, preference checks, opt-out support, audit, rate limit, blocked user safety handling, and manual approval.

This policy does not enable real email sending, does not enable real push sending, does not enable real n8n workflow triggering, does not enable provider calls, and does not enable queue jobs.

Raw contact logging remains disabled.

## Required scopes

Required preference scopes:

- global notification opt-in/out
- channel-level email preference
- channel-level push preference
- channel-level in-app preference
- child reminder preference
- saved search preference
- child lifecycle recommendation preference
- marketing opt-in
- security notification override rules
- mute/snooze window
- audit of preference updates

## Required decision states

Supported decision states:

- allowed
- blocked
- missing consent
- muted
- rate limited

Supported reason codes:

- consent missing
- channel disabled
- source disabled
- muted
- rate limited
- blocked by safety
- allowed

## Delivery boundary

The policy can approve a candidate at policy level, but delivery mutation remains disabled until real provider implementation. Provider call remains disabled.

Before real delivery:

- consent must exist
- channel preference must allow delivery
- source preference must allow delivery
- mute window must be checked
- rate limit must be checked
- blocked user/report/safety state must be checked
- audit must be recorded
- opt-out must be supported

## Privacy boundary

Do not log:

- email
- phone
- token
- cookie
- OTP
- password
- raw contact data
- raw provider response
- raw webhook payload
- authorization header
- provider secret

## Release boundary

The release gate must keep notification consent/preference policy honest:

- real sending disabled
- provider calls disabled
- queue jobs disabled
- webhook calls disabled
- raw contact logging disabled
- unconsented delivery blocked

## Exact guard wording

- raw contact logging remains disabled.

- real notification delivery remains blocked until explicit implementation.
