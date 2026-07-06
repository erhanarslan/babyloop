# Child reminder API scheduling boundary

Child reminder API scheduling boundary is the beta/release guard for child reminder due-state, channel, owner, and notification-delivery boundaries.

Run:

```bash
pnpm security:child-reminder-api-schedule
```

This guard covers:

- child reminder API contract uses `remindAt`, `channel`, and `status`;
- allowed channels are `in_app` and `email_draft`;
- allowed statuses are `scheduled`, `completed`, and `cancelled`;
- scheduled reminders must not become delivery candidates until `remindAt` is due;
- future reminders are skipped with `reminder_not_due`;
- invalid reminder dates are skipped with `reminder_invalid_date`;
- non-scheduled reminders are skipped with `reminder_not_scheduled`;
- child reminder delivery candidates remain `deliveryAllowed: false` and `draftOnly: true`;
- notification consent/preference remains required before any future delivery;
- frequency-window blocking remains active through `frequency_window_active`.

This boundary does not run queue jobs, does not send email, does not send push, does not trigger n8n, does not call providers, does not start workers, and does not claim real notification delivery.

Child reminder delivery remains draft-only until notification sender/provider, queue/job, observability, consent/preference, rate-limit, admin audit, and real-device QA gates are complete.
