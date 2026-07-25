# Deployment rollback

## Application rollback

Both managed workflows capture the previously serving Cloud Run revision before mutation. If a later step fails, the workflow attempts:

```bash
gcloud run services update-traffic babyloop-api --region=europe-west1 --project=<environment-project> --to-revisions=<previous-revision>=100
gcloud run services update-traffic babyloop-web --region=europe-west1 --project=<environment-project> --to-revisions=<previous-revision>=100
gcloud run services update-traffic babyloop-backoffice --region=europe-west1 --project=<environment-project> --to-revisions=<previous-revision>=100
```

Use the exact revisions in the release artifact. Never guess a revision or mutable image tag.

For a manifest-driven operator rollback:

```bash
ROLLBACK_CURRENT_MANIFEST_PATH=<current.json> \
ROLLBACK_TARGET_MANIFEST_PATH=<target.json> \
ROLLBACK_ALLOW_FORWARD_SCHEMA=true \
pnpm ops:release:rollback
```

Review the generated plan. Execution with the managed adapter additionally requires `ROLLBACK_EXECUTE=true`, the exact `ROLLBACK_CONFIRM`, `ROLLBACK_ADAPTER_PATH=scripts/deploy/adapters/gcp-cloud-run.mjs` and `GCP_ROLLBACK_CONFIRM=ROLLBACK_GCP_STAGING` or `ROLLBACK_GCP_PRODUCTION`.

## Database policy

There is no down migration. Application rollback keeps the current schema and is permitted only when the target code is forward-compatible with it. If it is not:

1. stop further writes or place the product in the incident mode approved by operations;
2. retain migration, backup and deployment evidence;
3. prefer a forward-fix migration/application release;
4. if recovery requires data restore, validate the backup checksum and restore into an isolated database first;
5. require incident approval before replacing a production database;
6. follow the guarded restore confirmations in `docs/83-backup-restore-rollback.md`.

Restoring a database is destructive and is never performed automatically by Actions.

## Post-rollback verification

Run the environment smoke, verify `/health/ready`, check worker heartbeats and notification claims, confirm the serving revision/digest and attach the smoke evidence to the incident. RAG index rollback is separate (`pnpm rag:index:rollback`) and must preserve the environment-specific collection/alias boundary.
