# BabyLoop release process

## Release lanes

| Change | Pull request | Automatic result |
| --- | --- | --- |
| Feature/fix | topic branch -> `staging` | PR CI, then staging deployment after merge |
| Production release | `staging` -> `master` | PR CI, then protected production promotion after merge |
| Emergency rerun | existing protected branch | `workflow_dispatch` with the same branch and Environment controls |

Direct pushes to `staging` or `master` are not part of the release model. Configure both branches to require pull requests and the `Release gate` status check.

## Workflow ownership

- `ci.yml`: secret-free PR release gate. It uses separate `DATABASE_URL` and `TEST_DATABASE_URL`, PostgreSQL 16, fake/noop providers, bounded concurrency, fresh migrations, deployment tests, typecheck, unit/release tests and builds.
- `deploy-staging.yml`: runs after a protected `staging` merge. It calls CI again as a merge-SHA gate, builds digest-pinned Artifact Registry images, scans them, backs up and migrates the staging database, deploys Cloud Run, then runs staging smoke.
- `promote-production.yml`: runs after a `staging -> master` release PR merge. The `production` GitHub Environment pauses the job for required reviewers. It resolves the staging parent SHA, verifies that its tree equals the master release tree, resolves the already-built Artifact Registry digests, then performs backup, migration, deployment and production smoke.
- `container-images.yml`: GHCR supply-chain workflow for manual/reusable image publication. It emits SHA/environment aliases, digests, SBOM/provenance and Trivy evidence. Cloud Run continues to use the selected Google Artifact Registry provider.
- `release-e2e.yml`: deliberately manual because it requires local services/browser orchestration and is evidence for release candidates, not an approval bypass.

## Migration ownership

The only runtime migration implementation is `apps/api/src/scripts/migrate-database.ts`, built into the API image. The Compose `migrate` service and Cloud Run `babyloop-migrate` job both invoke that same built script. API startup never migrates.

Every managed release runs:

1. `scripts/ops/database-release-safety.mjs --phase=preflight`
2. checksum/encryption-aware `scripts/ops/postgres-backup.mjs`
3. deploy the migration job definition only
4. execute and wait for the migration job
5. `scripts/ops/database-release-safety.mjs --phase=postflight`
6. deploy services/workers
7. environment smoke

Potential destructive SQL in pending journal migrations requires the environment variable `MIGRATION_ALLOW_DESTRUCTIVE_CONFIRM` to equal `ALLOW_DESTRUCTIVE_STAGING` or `ALLOW_DESTRUCTIVE_PRODUCTION`. Leave it unset normally.

## Image promotion invariant

Production does not rebuild. `promote-cloud-run-images.mjs` resolves the API/web/backoffice digests for the verified staging SHA from `babyloop-staging/europe-west1/babyloop-images`. Production deploys those exact digest references. The production deploy identity and Cloud Run service agent therefore need read access to the staging Artifact Registry repository.

Release PRs must preserve the staging tip as the second merge parent and must not change the release tree during merge. Squash-merging the release PR is unsupported because it destroys the staging SHA proof.

## Emergency dispatch

Use `workflow_dispatch` only to rerun a failed release from the matching protected branch. Staging dispatch refuses a non-staging ref; production refuses a non-master ref and still requires Environment approval, `PRODUCTION_RELEASE_APPROVED=true`, a verified staging SHA and identical Git tree.

After successful production smoke, the workflow creates `babyloop-vYYYY.MM.DD.N` and a generated GitHub Release. It never creates a release after a failed deployment.
