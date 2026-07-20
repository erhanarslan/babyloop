# Notification Worker Atomic Claim

## Purpose

The notification provider processor is database-backed and can be started concurrently by cron overlap, deploy replacement, manual operation or multiple replicas. A provider call must never begin from a plain candidate read. Each attempt first obtains an atomic lease on the delivery log row.

## State model

- `candidate`: ready for a first attempt.
- `processing`: owned by one worker until `claim_expires_at`.
- `failed` + `provider_status=retry_scheduled`: retryable after `next_attempt_at`.
- `sent`, `skipped`, or non-retryable `failed`: terminal.

Claim fields are `claim_token`, `claimed_at`, `claim_expires_at`, and `worker_id`. The claim token is internal and must never be returned through admin/public DTOs. Backoffice may show the sanitized worker id and lease timestamps.

## Concurrency contract

1. Candidate discovery is advisory only.
2. Before network I/O, the worker performs a conditional update from a claimable state to `processing`.
3. Only the update winner receives the claim token and calls the provider.
4. A second worker returns `duplicate/already_claimed` and performs no network call.
5. Final state updates require the same row id, `processing` status, and claim token.
6. An expired processing lease may be recovered. Stable provider idempotency headers continue to use the stable delivery-log idempotency key for crash ambiguity.

This provides single active execution per delivery log. As with any external network call, a process crash after provider acceptance but before the database commit is an ambiguous outcome. Resend and n8n receive stable idempotency keys; Expo push remains at-least-once across that narrow crash boundary and must be monitored.

## Graceful shutdown

The one-shot processor listens for `SIGTERM` and `SIGINT`, aborts the current request signal, stops claiming additional rows, emits a redacted summary, and closes the Fastify application. Failed/aborted provider attempts follow the normal retry policy and release their claim.

## Operations

- Default claim TTL: 5 minutes.
- Runtime minimum: 60 seconds.
- Runtime lease is never shorter than provider timeout plus 30 seconds.
- Stale claims are visible in notification ops through `processing`, worker id and lease expiry.
- Alert on final failures, a rising stale-recovery count, or processing rows whose lease is expired.
- Deployment still needs an external scheduler/cron definition; this patch does not create managed queue infrastructure.

## Verification

```bash
pnpm security:notification-worker-atomic-claim
TEST_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/babyloop_test \
  pnpm --filter @babyloop/api exec vitest run test/notification-provider-execution.service.test.ts --maxWorkers=1
```

## Migration and rollback

Apply migration `0042_notification_worker_atomic_claim` before starting the new processor. During rollback, stop all notification processors first, wait for or manually resolve `processing` rows, deploy the previous application version, then remove the claim index/columns and restore the old status constraint only if a database rollback is explicitly required. Do not drop claim columns while a new worker binary is running.
