# Runtime Readiness and Observability

## Scope

This foundation separates process liveness from dependency readiness and adds a bounded, redacted runtime error-reporting seam.

It does not provision Prometheus, Grafana, Sentry, OpenTelemetry collectors, cloud resources, alert channels, or deployment targets. Those systems must be configured explicitly in staging and production.

## Endpoints

### `GET /health/live`

Returns `200` when the Node.js process can serve requests. It does not call PostgreSQL, Qdrant, Redis, R2/S3, or notification workers.

Use this endpoint for container/process liveness checks. A dependency outage must not cause a process restart loop.

### `GET /health/ready`

Runs bounded probes and returns:

- `200` when every required dependency is ready,
- `503` when a required dependency is missing, stale, timed out, or failed.

The response exposes only safe status codes, durations, counts, backend names, and the expected migration identifier. It never returns connection strings, credentials, provider responses, request bodies, cookies, authorization headers, or claim tokens.

Readiness probes cover:

- PostgreSQL connectivity using `select 1`,
- current schema contract for notification claims and runtime worker heartbeats,
- local upload-root read/write access or S3/R2 `HeadBucket`,
- Qdrant collection access when RAG is enabled,
- Redis `PING` when a RAG backend requires Redis,
- notification-delivery and child-reminder worker heartbeat freshness,
- expired notification worker claims.

Expected database migration:

```text
0043_runtime_readiness_observability
```

## Worker heartbeat

The following one-shot workers record start, completion, failure, worker ID, last heartbeat, and a small allowlisted numeric/boolean summary:

- `notifications:process`
- `child-reminders:process`

The table is `runtime_worker_heartbeats`. It does not store recipient data, e-mail addresses, push tokens, notification metadata, request bodies, or raw exception stacks.

Production should set:

```text
HEALTH_REQUIRE_NOTIFICATION_WORKER=true
HEALTH_REQUIRE_CHILD_REMINDER_WORKER=true
HEALTH_FAIL_ON_STALE_NOTIFICATION_CLAIMS=true
```

Staleness thresholds must be longer than the actual scheduler interval plus a reasonable deployment/retry margin.

## Metrics

`GET /internal/metrics` returns bounded Prometheus text metrics only when:

```text
OBSERVABILITY_METRICS_ENABLED=true
OBSERVABILITY_METRICS_TOKEN=<long-random-secret>
```

The endpoint requires `Authorization: Bearer <token>` and uses a constant-time text comparison. It is disabled by default.

Metrics include:

- request totals by method, route template, and status class,
- response duration count/sum/max,
- readiness check/failure counts,
- external error report attempt/failure counts.

Route templates are used instead of raw URLs to avoid query-string leakage and unbounded label cardinality.

## Error reporting

`OBSERVABILITY_ERROR_WEBHOOK_URL` enables a provider-neutral HTTPS error sink. Payloads contain only:

- service and environment,
- error name, safe code, redacted message,
- event name,
- request ID, method, route template and status code, or worker name/ID.

The integration does not send request bodies, headers, cookies, tokens, database URLs, stack traces, user/profile IDs, e-mail addresses, or provider credentials.

Webhook delivery is best-effort and timeout-bounded. An unavailable error-reporting provider must not replace the original API response or worker failure.

## Validation

Run:

```bash
pnpm security:runtime-readiness-observability
pnpm test:api:readiness
pnpm --filter @babyloop/api typecheck
```

For a local database migration:

```bash
DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5432/babyloop_dev" \
pnpm --filter @babyloop/database db:migrate
```

Never apply the migration to production until the staging readiness endpoint, worker schedule, metrics authentication, error sink, backup, and rollback procedures have been verified.
