# Notification preference QA gate

Notification preference QA defines the release boundary for backoffice, mobile, and web notification preference visibility. This package is readiness-only.

Guard command:

```bash
pnpm security:notification-preference-qa
```

This guard is wired into:

```bash
pnpm beta:critical-smoke
```

## Current status

Current status: readiness-only.

Notification preference QA remains blocked until explicit implementation of backoffice notification preferences, mobile notification preferences, web notification preferences, audit display, opt-out controls, rate limit explanations, blocked user safety explanations, and manual QA evidence.

This gate does not enable real sending, does not enable provider calls, does not enable queue jobs, and does not enable webhook calls.

Raw contact logging remains disabled. Manual QA evidence is required before beta release.

## Required surfaces

Required QA surfaces:

- backoffice notification preferences
- mobile notification preferences
- web notification preferences

## Required channels

Required channel coverage:

- email
- push
- in-app
- n8n disabled state

## Required sources

Required source coverage:

- child reminder
- saved search
- child lifecycle
- marketing
- security

## Required QA scenarios

Required QA scenarios:

- backoffice notification preferences visible
- mobile notification preferences visible
- web notification preferences visible
- email channel opt-out visible
- push channel opt-out visible
- in-app channel opt-out visible
- n8n channel disabled state visible
- child reminder preference visible
- saved search preference visible
- child lifecycle preference visible
- preference audit state visible in backoffice
- disabled preference state explained
- consent required state explained
- rate limit state explained
- blocked user safety state explained
- manual QA evidence attached

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

A beta release cannot pass notification preference QA until user-facing and admin-facing preference states are visible, opt-out is visible, audit state is visible, disabled states are explained, and manual QA evidence is attached.

## Exact guard wording

- raw contact logging remains disabled.

- manual QA evidence is required before beta release.

- notification preference QA remains blocked until explicit implementation.
