# Child notebook/reminder hardening gate

Child notebook/reminder hardening defines the domain and release boundary for child-specific notes and reminders. This package is readiness-only.

Guard command:

```bash
pnpm security:child-notebook-reminder-hardening
```

This guard is wired into:

```bash
pnpm beta:critical-smoke
```

## Current status

Current status: readiness-only.

Child notebook/reminder runtime implementation remains blocked until explicit implementation, data model review, API contract review, web QA, mobile QA, notification preference integration, queue/job implementation, and beta smoke pass.

This gate does not create runtime CRUD, does not schedule queue jobs, does not send notifications, does not call providers, does not trigger n8n, and does not provide medical/therapy/diagnosis/drug/diet advice.

## Supported note/reminder types

Supported child notebook/reminder types:

- free note
- feeding
- diaper
- shopping
- activity
- appointment
- sleep
- other

## Supported schedules

Supported schedule policy:

- one-time reminder
- recurring reminder
- every-hours reminder, including every 2 hours feeding reminder
- daily reminder
- weekly reminder
- monthly reminder
- custom reminder
- preferred reminder time such as 10:00

## Advance reminder support

Supported advance reminder policy:

- no advance reminder
- same-day advance reminder
- one-day-before advance reminder
- one-week-before advance reminder

## Required flows

Required runtime flows before completion:

- web child notebook free note create/edit/delete
- mobile child notebook free note create/edit/delete
- one-time reminder create/edit/delete
- recurring reminder create/edit/delete
- every 2 hours feeding reminder
- diaper reminder
- shopping reminder
- activity reminder
- appointment reminder
- preferred time selection
- complete reminder
- cancel reminder
- snooze reminder
- notification preference link
- notification delivery skip when preference disabled
- owner-only access
- inactive child profile block
- no medical/therapy/diagnosis/drug/diet advice

## Notification preference boundary

Child reminders must connect to notification preference before any delivery. Notification delivery remains disabled until the notification sender/provider, observability, consent/preference, queue/job, and real-device QA gates are complete.

## Safety boundary

The notebook can store everyday parent notes and practical reminders. It must not produce or imply medical diagnosis, therapy guidance, drug dosage, treatment plan, or diet prescription.

## Release boundary

A beta release cannot mark child notebook/reminder complete until web and mobile flows pass, notification preference linkage is implemented, owner access is enforced, inactive child profiles are handled, and beta smoke includes this gate.

Exact guard wording: child notebook/reminder runtime implementation remains blocked until explicit implementation.

- Mobile child notebook/reminder screen-state QA covers child profile fallback, note/reminder payloads, local state updates, in-app reminder channel, and no push/email/n8n delivery claims.
