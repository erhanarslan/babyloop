# GitHub Environments, secrets and variables

Create GitHub Environments named exactly `staging` and `production`. No real value belongs in Git, `.env.local`, an example file or an Actions log.

## Environment-scoped GitHub secrets

Both environments require:

| Secret | Required | Purpose |
| --- | --- | --- |
| `RUNTIME_ENV_FILE` | yes | Complete chmod-600 dotenv content matching `deploy/env/runtime-env.contract.json` and the matching example. It is materialized only under `RUNNER_TEMP`, audited, imported into Secret Manager, and never uploaded. |

Do not create a GHCR personal token. `GITHUB_TOKEN` supplies package write access to `container-images.yml`.

The runtime file contains these secret classes when the corresponding provider is enabled:

- Database/auth: `DATABASE_URL`, `AUTH_SECRET`, `GOOGLE_CLIENT_SECRET`.
- R2-compatible storage: `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`. The repository intentionally uses S3-compatible names, not parallel `R2_*` aliases.
- Email: `RESEND_API_KEY` or `SMTP_USER`/`SMTP_PASS`; sender fields remain non-secret runtime configuration.
- AI/RAG: `GEMINI_API_KEY` and/or `OPENAI_API_KEY`, `RAG_QDRANT_API_KEY`, `RAG_REDIS_URL`.
- Push/operations: `EXPO_ACCESS_TOKEN`, `PUSH_TOKEN_ENCRYPTION_KEY`, observability/webhook tokens when enabled.
- Backup: `BACKUP_AGE_RECIPIENT` is public-key material but is kept in the protected runtime contract; the private age identity is never an application/GitHub runtime secret and belongs in the restore operator vault.

`TEST_DATABASE_URL` is CI-only and is created from the ephemeral PostgreSQL service. It must not be placed in staging/production.

## Environment-scoped GitHub variables

| Variable | staging | production | Purpose |
| --- | --- | --- | --- |
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | required | required | Full Workload Identity Provider resource name for keyless Actions auth. |
| `GCP_DEPLOY_SERVICE_ACCOUNT` | required | required | Environment-specific deployer service account email. Never store a JSON key. |
| `EXPECTED_DATABASE_NAME` | required; must contain `staging` | required; must contain `production` | Wrong-database migration guard. |
| `OTHER_ENV_DATABASE_FINGERPRINT` | production DB target fingerprint | staging DB target fingerprint | SHA-256 of `lowercase-host:port/database`; proves targets differ without storing the other credential. |
| `OTHER_ENV_QDRANT_API_KEY_SHA256` | SHA-256 of production Qdrant key | SHA-256 of staging Qdrant key | Fails a release if shared-cluster credentials are reused. The hash is not the key. |
| `MIGRATION_ALLOW_DESTRUCTIVE_CONFIRM` | normally empty | normally empty | Temporary reviewed override for a detected pending destructive migration. |
| `PRODUCTION_RELEASE_APPROVED` | not used | exactly `true` | Explicit configuration guard in addition to required reviewers. |

The GHCR workflow reads these repository variables:

- `STAGING_PUBLIC_API_BASE_URL`, `STAGING_PUBLIC_SITE_URL`, `STAGING_PUBLIC_BACKOFFICE_URL`
- `PRODUCTION_PUBLIC_API_BASE_URL`, `PRODUCTION_PUBLIC_SITE_URL`, `PRODUCTION_PUBLIC_BACKOFFICE_URL`
- `LEGAL_OPERATOR_NAME`, `LEGAL_CONTACT_EMAIL`, `LEGAL_CONTACT_ADDRESS`

These are public build-time values. Runtime secrets must never be supplied as Docker build arguments.

## Runtime isolation requirements

- Staging and production `DATABASE_URL` values must target different databases and projects.
- A shared Qdrant endpoint is allowed, but `RAG_QDRANT_API_KEY` and `RAG_QDRANT_COLLECTION` must be environment-specific. Collection names must contain `staging` or `production`.
- A shared Upstash endpoint/`RAG_REDIS_URL` is temporarily allowed. Prefixes are mandatory: `babyloop:staging:rag` and `babyloop:production:rag`.
- Public web/API/backoffice origins must be distinct and must match the selected environment.

Generate comparison hashes locally without printing secrets to Actions. The database fingerprint input is `lowercase-host:port/database`; hash the exact Qdrant API key bytes with SHA-256. Store only the resulting lowercase 64-character hashes as Environment variables.

## Protection settings

For `production`:

1. Add at least one required reviewer who is not the release author.
2. Prevent administrators from bypassing reviewers.
3. Restrict deployment branches to `master`.
4. Disable self-review where available.
5. Keep environment secrets scoped only to `production`.

For `staging`, restrict deployment branches to `staging`. Reviewers are optional.

Branch protection/rulesets for both `staging` and `master`:

- require a pull request;
- require approval and dismissal of stale approvals;
- require conversation resolution;
- require branches to be up to date;
- require the Actions check displayed as `Release gate` (confirm the exact displayed name after the first PR run);
- block force pushes and deletion;
- do not allow direct administrator bypass.

`master` release PRs must use a merge commit so `promote-production.yml` can prove the staging parent SHA and identical release tree.

## Google Cloud manual IAM

Bootstrap the two projects with the checked-in GCP scripts. Configure keyless Workload Identity Federation restricted to this repository, workflow refs and the matching GitHub Environment.

The deployer needs the repository's documented Cloud Run/Job, Secret Manager version, Artifact Registry, Scheduler and service-account impersonation permissions, plus read-only billing/project inspection required by `assertGcloudContext`. Production additionally needs `roles/artifactregistry.reader` on the staging `babyloop-images` repository. Grant the production Cloud Run service agent/runtime identities the minimum read access needed to pull those staging digest images.
