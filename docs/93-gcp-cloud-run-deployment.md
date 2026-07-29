# Google Cloud Run single-production deployment

## Physical and logical boundary

BabyLoop has one physical GCP deployment environment. The logical `production` environment maps to project `babyloop-staging`, region `europe-west1`, and Artifact Registry repository `babyloop-images`. Logical `staging` is `deployable=false` and exists only for CI and static/read-only rehearsal.

The production resource names remain unchanged:

- services: `babyloop-api`, `babyloop-web`, `babyloop-backoffice`;
- jobs: `babyloop-migrate`, `babyloop-notification-worker`, `babyloop-child-reminder-worker`;
- schedulers: `babyloop-notification-worker-schedule`, `babyloop-child-reminder-worker-schedule`.

Every mutating GCP script validates all of these invariants before proceeding:

- `DEPLOY_TOPOLOGY=single_environment`;
- logical environment is `production`;
- physical project is `babyloop-staging`;
- GitHub ref is exactly `refs/heads/master`, or a local invocation is on branch `master`;
- the worktree has no staged, unstaged, or untracked files;
- active gcloud project and region match the contract.

## Release behavior

`deploy-staging.yml` performs the reusable CI gate, static release rehearsal and contract/security checks. It has no Google authentication, database backup, migration, image build, Secret Manager, Cloud Run, Job or Scheduler mutation step.

`promote-production.yml` runs from `master` behind the protected GitHub `production` environment. It audits the production runtime file, performs a live read-only rehearsal, imports pinned secret versions, builds immutable images in the single registry, scans digest-pinned images, captures current traffic, performs database preflight/backup/migration/postflight, deploys the existing resources, runs mandatory public smoke, records immutable evidence and rolls traffic back on a failed rollout.

Existing services are described by their unchanged names before mutation. A returned snapshot is `existing` and `exact_traffic_restorable`, whether traffic is 100% on one revision or split across revisions. Initial-bootstrap confirmation is considered only when the physical service genuinely returns `NOT_FOUND`; logical production being newly introduced does not imply an absent service.

## Runtime and database policy

The production runtime contract requires:

- `WEB_APP_URL`, `NEXT_PUBLIC_SITE_URL`, `BABYLOOP_SITE_URL`, and `EXPO_PUBLIC_WEB_BASE_URL`: `https://babyloop.com.tr`;
- `NEXT_PUBLIC_API_BASE_URL` and `BABYLOOP_API_BASE_URL`: `https://api.babyloop.com.tr`;
- `NEXT_PUBLIC_BACKOFFICE_BASE_URL`: `https://admin.babyloop.com.tr`;
- `CORS_ORIGINS`: exactly `https://babyloop.com.tr,https://admin.babyloop.com.tr`;
- `GOOGLE_REDIRECT_URI`: `https://api.babyloop.com.tr/api/v1/auth/google/callback`;
- production environment markers and mandatory public smoke;
- `DEPLOY_TOPOLOGY=single_environment`.

The topology removes cross-environment database/Qdrant comparison inputs. It does not weaken `EXPECTED_DATABASE_NAME`, reserved database rejection, read-only preflight, encrypted backup with byte-verified replica, migration-chain checks, destructive SQL review, or critical-table postflight. Destructive migration confirmation remains unset during a normal release.

The production audit also requires a checksum-protected inventory of the non-secret identifiers currently used by the sole physical runtime. Qdrant collection, Redis prefix, worker IDs, S3 bucket/endpoint and the other listed provider endpoints may retain neutral or historical names; they do not need the word `production`. A changed identifier requires `ALLOW_PROVIDER_IDENTIFIER_MIGRATION_PRODUCTION`. A worker-ID change additionally requires checksum-protected, passed controlled-worker verification evidence. Neither the deploy patch nor the workflow executes a business worker to manufacture that evidence. Missing inventory fails closed, and secret values are neither inventoried nor compared.

## Domain cutover runbook

Domain mapping changes are deliberately outside the workflow. The first cutover order is exact:

1. Merge the single-environment patch from its topic branch into `staging`.
2. Wait for the staging validation workflow to pass.
3. Prepare the GitHub `production` Environment variables and secrets.
4. Verify WIF/IAM for the `production` Environment and `promote-production.yml`.
5. Prepare the production runtime contract, but do not deploy it.
6. Pre-create production domain mappings on the existing services: `babyloop.com.tr` → `babyloop-web`, `api.babyloop.com.tr` → `babyloop-api`, and `admin.babyloop.com.tr` → `babyloop-backoffice`.
7. Add the returned Cloudflare DNS-only records.
8. Wait until all three managed certificates report `True`.
9. Verify that all production domains return HTTP/TLS responses from the existing services.
10. Add `https://api.babyloop.com.tr/api/v1/auth/google/callback` to the Google OAuth client.
11. Merge the `staging` → `master` release PR.
12. Let the production workflow deploy the production configuration.
13. Require mandatory production smoke to pass.
14. Only then remove the `staging.*` mappings and DNS records.

The production workflow's live read-only rehearsal deliberately treats step 9 as a prerequisite. It cannot pass before the public production domains are reachable, and the workflow never creates, updates, or deletes domain mappings.

The checked-in patch never creates or deletes a domain mapping.

## Artifact Registry cleanup policy

No live image deletion is automated by the release workflow. Operators must first produce a read-only inventory, resolve every tag to its digest, and reconcile it against:

- digests used by every current service/job revision;
- digests referenced by the rollback snapshot;
- the most recent successful release manifests (retain at least the last 10 releases);
- active `buildcache` references.

Only old untagged digests and old SHA-tagged release digests outside every protected set may become candidates. The first pass is always list/dry-run and records each candidate digest, its resolved tags, age, cross-references to service/job revisions and release manifests, and the reason it is unused. Deletion is a separate operator action and requires exact `DELETE_UNUSED_ARTIFACTS_PRODUCTION` confirmation. Missing confirmation, incomplete inventory, an unresolved tag/revision/job, missing rollback or recent-release evidence, or uncertainty about build cache means zero deletion.

## Cost and security boundaries

Services retain `min-instances=0`, `max-instances=1`; notification/reminder jobs retain the bounded five-minute schedules. Scheduler has job-scoped `roles/run.invoker`, migration is never scheduled, service-account keys are forbidden, secrets are passed through stdin and pinned by version, and images are deployed by digest with SBOM/provenance evidence. Production worker bootstrap grace remains zero.
