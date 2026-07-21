# 90 — Staging Bootstrap and Provider Readiness

## Purpose

Patch 21 separates release preparation into three explicit, checksum-bound layers:

1. **Runtime configuration audit**
2. **Staging bootstrap plan**
3. **Live provider probe**

No production GO receipt can be created without evidence from all three layers.

## Files

| File | Purpose |
| --- | --- |
| `deploy/env/staging.env.example` | Application runtime configuration and secret placeholders |
| `deploy/env/staging.release.env.example` | Non-secret deployment orchestration, image digests, domains and evidence paths |
| `deploy/env/runtime-env.contract.json` | Machine-readable runtime configuration contract |
| `scripts/deploy/audit-runtime-env.mjs` | Strict env validation and redacted evidence |
| `scripts/deploy/create-staging-bootstrap-plan.mjs` | Immutable image/domain/compose plan |
| `scripts/deploy/execute-staging-deploy.mjs` | Confirmation-gated staging deployment |
| `scripts/deploy/render-compose-plan.mjs` | Non-mutating Compose render with absolute env path and digest validation |
| `scripts/deploy/provider-probe.mjs` | Plan or live provider probes |
| `scripts/deploy/staging-bootstrap.sh` | Non-mutating preparation orchestration |

## Secret handling

Create the real runtime env outside the repository:

```bash
install -d -m 700 /etc/babyloop
install -m 600 deploy/env/staging.env.example /etc/babyloop/staging.runtime.env
```

Replace all placeholders. The audit rejects:

- group/world-readable env files,
- placeholder values,
- local or insecure provider URLs,
- missing conditional secrets,
- weak auth and push-encryption keys,
- origin/CORS mismatches,
- public variables that contain secret values.

The audit receipt lists only secret **names**, never secret values.

## Immutable image manifest

The manual `Container images` GitHub workflow remains `workflow_dispatch` only. `pnpm security:manual-workflows` parses only the top-level YAML `on:` mapping across every workflow file; nested action inputs such as `docker/build-push-action`'s `push: true` are not mistaken for automatic GitHub triggers.

`pnpm security:deployment-command-safety` inspects only executable deployment and backup files. JavaScript comments and string literals are removed before checking child-process options, so guard messages such as `"shell: true"` are not false positives. Deployment shell scripts fail closed on `source`, dot evaluation, `eval`, `bash -c`, and `sh -c`; runtime env files must continue to use the bounded non-evaluating parser.
 Each matrix build uploads its digest metadata, and the final manifest job assembles:

- API image digest,
- web image digest,
- backoffice image digest,
- environment,
- full Git SHA,
- checksum companion file.

Download the `babyloop-container-image-manifest-<environment>-<sha>` artifact to the deployment host and set `IMAGE_MANIFEST_PATH` in the release env. The staging plan rejects mutable tags, incomplete matrix output, environment mismatch and Git SHA mismatch.

## Release orchestration file

Create a separate release env:

```bash
install -m 600 deploy/env/staging.release.env.example /etc/babyloop/staging.release.env
```

This file contains image digests and deployment paths, not application secrets. Every image must use:

```text
registry/name@sha256:<64 lowercase hexadecimal characters>
```

Mutable tags such as `latest`, `main`, or a Git tag are not accepted.

## Preparation

Load only the release orchestration variables into the shell:

```bash
set -a
source /etc/babyloop/staging.release.env
set +a

export DEPLOY_RELEASE_ENV_FILE=/etc/babyloop/staging.release.env
export DEPLOY_ENV_FILE=/etc/babyloop/staging.runtime.env

pnpm deploy:staging:prepare
```

Before deployment, render the Compose plan through the canonical command:

```bash
DEPLOY_ENVIRONMENT=staging \
DEPLOY_ENV_FILE=/etc/babyloop/staging.runtime.env \
DEPLOY_GIT_SHA="$(git rev-parse HEAD)" \
API_IMAGE='registry/api@sha256:<digest>' \
WEB_IMAGE='registry/web@sha256:<digest>' \
BACKOFFICE_IMAGE='registry/backoffice@sha256:<digest>' \
pnpm deploy:compose:plan
```

The command resolves `DEPLOY_ENV_FILE` to an absolute path before passing it to Docker Compose. This prevents Compose from interpreting a repository-relative runtime env path relative to `deploy/compose`. It only runs `docker compose config --quiet`; it cannot start services or authorize migrations.

This performs no deployment and no provider mutation. It creates:

- runtime env audit evidence,
- checksum-protected staging bootstrap plan,
- provider probe plan,
- repository release guard result.

## Deployment

Deployment requires an explicit confirmation:

```bash
STAGING_DEPLOY_CONFIRM=DEPLOY_STAGING \
pnpm deploy:staging:execute \
  --release-env=/etc/babyloop/staging.release.env
```

Execution revalidates:

- current Git SHA,
- runtime env audit,
- bootstrap plan freshness,
- image digests,
- Docker Compose rendering,
- runtime env contract.

It then delegates to the existing promotion pipeline, which runs backup, migration, rollout and acceptance in the enforced order.

## Provider probe

Inspect the plan first:

```bash
DEPLOY_ENV_FILE=/etc/babyloop/staging.runtime.env \
pnpm deploy:providers:plan
```

A live probe is intentionally explicit because it performs temporary R2 writes and real notification delivery:

```bash
DEPLOY_ENV_FILE=/etc/babyloop/staging.runtime.env \
DEPLOY_GIT_SHA="$(git rev-parse HEAD)" \
PROVIDER_PROBE_CONFIRM=PROBE_STAGING_PROVIDERS \
PROVIDER_PROBE_ALLOW_R2_WRITE=true \
PROVIDER_PROBE_ALLOW_NOTIFICATION_SEND=true \
PROVIDER_PROBE_EVIDENCE_PATH=/var/lib/babyloop/evidence/staging-provider-probe.json \
pnpm deploy:providers:probe
```

The live probe requires all of these checks to pass:

- API readiness
- PostgreSQL readiness
- durable image-storage readiness
- Qdrant readiness
- Redis readiness
- notification-worker heartbeat
- child-reminder-worker heartbeat
- R2 upload/read/delete round trip
- real email and Expo push delivery
- live RAG acceptance
- analytics database smoke

## Production GO inputs

Production GO now requires matching, fresh evidence for:

1. runtime env audit,
2. staging bootstrap plan,
3. live provider probe,
4. staging deployment acceptance,
5. restore smoke,
6. Galaxy S22 mobile evidence,
7. manually reviewed provider evidence.

All evidence must have the same full Git SHA and valid `.sha256` companion file.
