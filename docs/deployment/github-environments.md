# GitHub production environment contract

GitHub has a protected Environment named exactly `production`. The `staging` branch runs CI/rehearsal only and needs no GCP credentials or runtime secret.

## Required production variables

- `GCP_WORKLOAD_IDENTITY_PROVIDER`: full keyless Workload Identity Provider resource name.
- `GCP_DEPLOY_SERVICE_ACCOUNT`: deployer identity for physical project `babyloop-staging`; never a JSON key.
- `EXPECTED_DATABASE_NAME`: exact approved production database name. The hostname/name remain secret in `RUNTIME_ENV_FILE`.
- `PRODUCTION_RELEASE_APPROVED`: exactly `true`, in addition to reviewer approval.
- `DEPLOY_TOPOLOGY`: exactly `single_environment`.
- `CURRENT_RUNTIME_IDENTIFIER_INVENTORY_JSON`: checksum-protected-at-materialization JSON inventory of current non-secret provider and worker identifiers. Missing inventory blocks production.

`PROVIDER_IDENTIFIER_MIGRATION_CONFIRM` is normally unset. Set it temporarily to exact `ALLOW_PROVIDER_IDENTIFIER_MIGRATION_PRODUCTION` only for a separately reviewed identifier migration. A worker-ID change also requires `WORKER_IDENTIFIER_MIGRATION_EVIDENCE_JSON`, a passed checksum-protected-at-materialization controlled-worker verification receipt. Normal cutover preserves every inventoried identifier and requires neither optional variable.

The inventory has `schemaVersion: 1`, `kind: "current_runtime_identifier_inventory"`, `environment: "production"`, `topology: "single_environment"`, and an `identifiers` object containing exactly: `RAG_QDRANT_URL`, `RAG_QDRANT_COLLECTION`, `RAG_REDIS_KEY_PREFIX`, both worker IDs, `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `IMAGE_STORAGE_PUBLIC_BASE_URL`, `RESEND_API_BASE_URL`, and `EXPO_PUSH_API_BASE_URL`. Populate those values by read-only inspection of the currently running physical environment. Do not include Redis URLs, credentials, API keys, tokens, or any other secret-bearing field.

## Required production secret

- `RUNTIME_ENV_FILE`: complete dotenv content matching `deploy/env/runtime-env.contract.json`. It is materialized only below `RUNNER_TEMP`, chmod 600, audited before mutation, imported without logging values and never uploaded.

The single-environment topology does not use cross-environment database fingerprints or Qdrant key hashes. Existing services do not require an initial-bootstrap confirmation. A normal release leaves destructive-migration confirmation unset; it may be supplied only after a specific pending SQL review.

`RUNTIME_ENV_FILE` contains provider secrets only when their feature is enabled: database/auth, storage credentials, email, AI/RAG, Redis, push and operations tokens. `TEST_DATABASE_URL` is CI-only and must not be placed in this environment.

## Protection settings

1. Require at least one reviewer who is not the release author.
2. Prevent administrator/reviewer bypass and self-review where supported.
3. Restrict deployments to `master`.
4. Keep secrets scoped only to `production`.
5. Require the PR `Release gate`, current branch and resolved conversations.
6. Block force pushes and branch deletion.

## Google Cloud IAM

Restrict Workload Identity Federation to this repository, `promote-production.yml`, `refs/heads/master`, and the `production` GitHub Environment. The deployer needs only the documented Cloud Run/Job, Secret Manager version, Artifact Registry, Scheduler, service-account impersonation, backup, and read-only project/billing permissions within `babyloop-staging`.
