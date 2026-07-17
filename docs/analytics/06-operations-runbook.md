# Analytics Operations Runbook

Commands:

- `pnpm security:product-analytics-privacy`
- `pnpm test:analytics:api`
- `pnpm test:analytics:web`
- `pnpm test:analytics:mobile`
- `pnpm test:analytics:backoffice`
- `pnpm analytics:rollup`
- `pnpm analytics:retention`
- `pnpm release:analytics`

Rollup:

- `ANALYTICS_ROLLUP_DATE=2026-07-16 pnpm analytics:rollup`
- `ANALYTICS_ROLLUP_PLATFORM=web pnpm analytics:rollup`

Retention:

- Dry run is default.
- Actual deletion requires `ANALYTICS_RETENTION_DRY_RUN=false` and `ANALYTICS_RETENTION_CONFIRM=DELETE_EXPIRED_ANALYTICS`.

Backfill:

- Date range backfill should run day by day and report row counts.
- Production full deletes are not part of analytics backfill.

Troubleshooting:

- Check rejected/duplicate event counts in the data quality panel.
- Verify rollup lag before treating a zero dashboard as true zero usage.
- Never inspect raw event property dumps for support unless a specific audited support workflow is added.
