# Staging release

## Normal release

1. Open a PR from the topic branch to `staging`.
2. Wait for `Release gate`.
3. Merge through branch protection.
4. `Deploy staging` runs on the merge SHA and repeats the CI gate.
5. Inspect the job summary and `staging-release-<sha>` artifact.

The deployment sequence is runtime-env audit, pinned Secret Manager import, immutable image build, Trivy scan, database preflight, verified backup, migration-only job deployment, migration execution, schema postflight, service/worker deployment and smoke.

The smoke evidence checks API live/ready, database/schema/storage, Qdrant and Redis when enabled, OpenAPI JSON, capabilities/analytics readiness, categories, marketplace listings, public web and browse/login pages, backoffice login, legal/support pages, response headers/sizes/latency and protected metrics when configured.

## Manual rerun

From GitHub Actions, dispatch `Deploy staging` on the `staging` branch. The branch guard rejects other refs. The run does not bypass CI or the staging Environment.

Local read-only preparation:

```bash
pnpm deploy:check:staging
pnpm security:deployment-command-safety
pnpm security:staging-deployment
pnpm test:deploy
pnpm test:gcp:cloud-run
```

Provider execution is intentionally performed by Actions with WIF. For an operator-driven emergency run, follow `docs/93-gcp-cloud-run-deployment.md` using the same digest manifest and confirmations; do not rebuild an accepted release under the same SHA.

## Failure

The workflow records the previous serving revision for all three services. On a later failure it attempts to route 100% traffic back to those revisions and uploads the rollback inputs. Database down migrations are never automatic. If migration already succeeded, use a compatible application revision and forward-fix; restore the verified backup only through the incident procedure.
