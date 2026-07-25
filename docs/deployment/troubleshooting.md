# Deployment troubleshooting

## GitHub shows `no runs found`

Historically all workflows were `workflow_dispatch` only, so pushes and PRs produced no runs. The current contract runs `CI` on PRs to `staging`/`master`, `Deploy staging` on pushes to `staging`, and `Promote production` on pushes to `master`. If no run appears now:

1. confirm the workflow files exist on the target branch;
2. confirm Actions is enabled for the repository;
3. inspect ruleset/action policy restrictions;
4. confirm the PR base branch is exactly `staging` or `master`;
5. validate workflow YAML and the release trigger guard.

## Environment or secret failure

- `RUNTIME_ENV_FILE is empty`: add it to the matching GitHub Environment, not repository secrets.
- Runtime audit reports a placeholder: replace every `REPLACE_WITH` value in the protected secret.
- Permission failure: the materialized file must be mode 600; Actions sets this automatically.
- Qdrant/Redis isolation failure: use an environment-specific collection and the exact required Redis prefix.
- Wrong database failure: set `EXPECTED_DATABASE_NAME` to the real database name containing the environment word and correct `DATABASE_URL`; never weaken the check.

## Google authentication/deployment failure

- Verify WIF subject restrictions include this repository, workflow and Environment.
- Verify `GCP_DEPLOY_SERVICE_ACCOUNT` belongs to the matching project.
- The scripts require active project `babyloop-staging`/`babyloop-production` and region `europe-west1`.
- Production image resolution requires the production deployer to read the staging Artifact Registry repository.
- Production runtime image pull failures require cross-project Artifact Registry reader permission for the appropriate Cloud Run service agent/runtime identity.
- Billing inspection errors mean the deployer lacks the read-only permission used by the context guard; they do not justify skipping the guard.

## Migration failure

- Read the database preflight/migration evidence artifact before retrying.
- If pending SQL is destructive, review it and temporarily set the exact environment confirmation variable. Remove it after the release.
- A migration job has zero retries and an advisory lock. Confirm no operator migration is holding the lock.
- If migration succeeded but rollout failed, do not rerun blindly. Check the Drizzle journal/postflight and use a forward-compatible application rollback or forward-fix.

## Smoke failure

- `/health/ready` exposes dependency codes without secret values. Check database, schema, storage, Qdrant, Redis and worker heartbeats.
- OpenAPI is expected at `/docs/json`; public login is `/login`; backoffice login is `/login`.
- Smoke never logs response bodies or authorization tokens. Use Cloud Run logs for server-side diagnosis.
- A performance threshold failure is blocking in production and reported as a warning/non-blocking threshold in staging according to the runtime contract.

## Image scan failure

Trivy reports HIGH and CRITICAL findings and blocks the current workflow for unresolved findings in the configured severity set. Review the SARIF artifact, distinguish base-image/package remediation from an accepted unfixed upstream item, update the base/dependency, and rerun. Do not suppress a finding only to make the pipeline green.
