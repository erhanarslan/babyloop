# Google Cloud Run deployment target

## Fixed project boundary

| Environment | Project | Region | Active gcloud configuration |
|---|---|---|---|
| staging | `babyloop-staging` | `europe-west1` | `babyloop-staging` |
| production | `babyloop-production` | `europe-west1` | `babyloop-production` |

The scripts refuse to mutate resources when the active gcloud project does not match the requested environment. Billing must be enabled and an authenticated account must be active.

## Cost boundary

All three initial Cloud Run services use `min-instances=0` and `max-instances=1`. API uses 1 vCPU/1 GiB; web and backoffice use 1 vCPU/512 MiB. Notification and child-reminder processing run every five minutes as Cloud Run Jobs rather than continuously running workers. The migration job has no schedule and zero retries.

The Google Cloud budget remains an alert, not a spending cap. Cloud Run scaling limits are the runtime cost guard.

## Security boundary

- separate runtime service accounts for API, web, backoffice, jobs, and Scheduler;
- no service-account JSON keys;
- authenticated Cloud Scheduler invocation of private Cloud Run Jobs;
- Scheduler receives `roles/run.invoker` only on the scheduled notification and reminder job resources; no project-wide Cloud Run invoker grant is retained;
- the migration job is never granted to the Scheduler identity;
- runtime secrets imported through stdin into Secret Manager;
- secret values are never written to receipts or terminal output;
- secret versions are pinned in `secret-manifest.json`;
- Linux/AMD64 images are stored in regional Artifact Registry and deployed by digest;
- image build enables minimal provenance and SBOM attestations;
- every mutation requires an environment-specific confirmation token;
- migration is a separate explicitly confirmed job execution.

## Order of operations

```bash
# 1. Read-only plan
pnpm gcp:cloud-run:plan -- --environment=staging

# 2. APIs, Artifact Registry, identities
GCP_BOOTSTRAP_CONFIRM=BOOTSTRAP_STAGING \
pnpm gcp:cloud-run:bootstrap -- --environment=staging

# 2a. Remove legacy project-wide Scheduler invoker access
GCP_IAM_REPAIR_CONFIRM=IAM_REPAIR_STAGING \
pnpm gcp:cloud-run:iam:repair -- --environment=staging

# 2b. Read-only IAM verification
pnpm gcp:cloud-run:iam:audit -- --environment=staging

# 3. After the provider-backed runtime env passes the existing audit
GCP_SECRET_IMPORT_CONFIRM=SECRET_IMPORT_STAGING \
pnpm gcp:cloud-run:secrets -- \
  --environment=staging \
  --env-file="$HOME/.babyloop/env/staging.runtime.env"

# 4. Build immutable images locally and push to Artifact Registry
GCP_BUILD_CONFIRM=BUILD_STAGING \
pnpm gcp:cloud-run:build -- \
  --environment=staging \
  --env-file="$HOME/.babyloop/env/staging.runtime.env"

# 5. Deploy services and jobs; migration is not executed
GCP_DEPLOY_CONFIRM=DEPLOY_STAGING \
pnpm gcp:cloud-run:deploy -- --environment=staging

# 6. Explicit one-shot migration
GCP_MIGRATION_CONFIRM=APPLY_STAGING \
pnpm gcp:cloud-run:migrate -- --environment=staging
```

Production uses the same sequence with the production gcloud configuration and production confirmation values.

## Domain mapping

Cloud Run domain mapping is Preview in `europe-west1`. It can be used without Cloudflare by adding the returned DNS records at the domain registrar. It is not the long-term recommended Google option, so retain the `run.app` endpoints and migrate to a global external Application Load Balancer when traffic/revenue justifies its fixed cost.

```bash
GCP_DOMAIN_MAP_CONFIRM=DOMAIN_MAP_STAGING \
pnpm gcp:cloud-run:domains -- \
  --environment=staging \
  --base-domain=babyloop.com.tr
```

The command first requires the base domain to be verified in Google Search Console and writes the exact registrar DNS records to a checksum-protected local receipt.
