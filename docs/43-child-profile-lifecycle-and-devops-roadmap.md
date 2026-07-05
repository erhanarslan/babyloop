# BabyLoop Child Profile, Lifecycle Personalization, Queue, n8n, and DevOps Roadmap

## Status

Child profile, notes, reminders, and lifecycle recommendation foundations exist. This area must be completed end-to-end because it is one of BabyLoop's core differentiators.

## Child profile completion scope

Required:

- multiple child profiles,
- birth date / age band / development-stage logic,
- web child notebook,
- mobile child notebook,
- child-specific notes,
- one-time reminders,
- recurring reminders,
- feeding/diaper/activity/shopping/appointment reminder types,
- "every 2 hours" style reminder cadence,
- advance reminders such as 1 week before, 1 day before, same day,
- user-selected reminder time such as 10:00,
- complete/cancel/snooze flows,
- child age-based product recommendations,
- seasonal needs recommendations,
- saved search + child profile connection,
- notification preference connection.

## Queue/job and n8n direction

A queue/job system is required. It should feed end-of-day/daily data into n8n and support:

- child lifecycle notifications,
- child reminder notifications,
- saved search notifications,
- product recommendation digests,
- fraud scans,
- stale listing cleanup,
- analytics aggregation.

Preferred options to evaluate:

- BullMQ + Redis,
- PostgreSQL-backed jobs for a simpler first production step.

## Data privacy

Child profile data must not leak into:

- public listing APIs,
- seller-facing APIs,
- raw analytics payloads,
- audit metadata,
- unsafe logs.

Analytics should use safe identifiers and aggregated signals where possible.

## DevOps timing

Full DevOps/deployment/observability is important but should be finalized near the end of feature completion. S3 bucket setup exists. Remaining required DevOps work includes:

- managed PostgreSQL,
- production Redis,
- queue workers,
- deployment pipeline,
- secrets management,
- staging/production separation,
- structured logs,
- metrics,
- error tracking,
- alerts,
- backups,
- restore testing,
- migration rollback,
- incident runbooks,
- cost monitoring,
- release smoke pipeline.

## Child reminder delivery candidate pipeline

Child reminders now have a candidate pipeline target: scheduled reminders can be represented as `notification_delivery_logs` candidate records with `kind=child_reminder`.

This is not real delivery yet. It keeps `deliveryAllowed=false` and `draftOnly=true`, applies frequency window/idempotency boundaries, and avoids email/push/n8n sender integration until retry, audit, and provider-specific result transitions are implemented. Guard: `pnpm security:child-reminder-delivery`.
