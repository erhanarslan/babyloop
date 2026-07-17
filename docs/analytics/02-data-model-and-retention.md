# Analytics Data Model and Retention

Product analytics is stored separately from admin/security audit and operational observability.

Tables:

- `analytics_events`: append-only raw product events with idempotent `eventId`.
- `analytics_sessions`: session-level aggregate state.
- `analytics_daily_overview`: daily aggregate KPIs.
- `analytics_daily_pages`: route/screen engagement aggregates.
- `analytics_daily_categories`: category funnel aggregates.
- `analytics_daily_auth`: provider/auth verification trend aggregates.

Raw analytics retention defaults to 90 days. Session retention defaults to 180 days. Daily aggregates are intended for longer-lived reporting. Retention is handled by `pnpm analytics:retention`; destructive deletion requires `ANALYTICS_RETENTION_CONFIRM=DELETE_EXPIRED_ANALYTICS`.

User deletion/anonymization should null or pseudonymize raw analytics `userId`/`profileId` where applicable. Aggregate tables may remain because they do not contain raw user content.
