# BabyLoop staging and production deployment

This runbook is the executable deployment contract for the API, public web, backoffice, notification worker, child-reminder worker and database migration job.

## Runtime topology

- `api`: Fastify API, port 4000, `/health/live`, `/health/ready`, protected `/internal/metrics`.
- `web`: Next.js standalone public application, port 3000.
- `backoffice`: Next.js standalone admin application, port 3001.
- `notification-worker`: controlled loop around one atomic notification delivery cycle.
- `child-reminder-worker`: controlled loop around one child reminder scheduling cycle.
- `migrate`: one-shot, advisory-lock protected Drizzle migration job.
- PostgreSQL, Redis, Qdrant, R2/S3 and the HTTPS reverse proxy are external persistent dependencies.

The runtime compose file binds application ports to `127.0.0.1`. A reverse proxy such as Caddy terminates HTTPS and exposes the three public domains.

## Image build

Images are built from `deploy/docker/Dockerfile` using the `api`, `web` and `backoffice` targets. Next.js images use standalone output. Runtime containers run as the unprivileged `node` user, use read-only root filesystems and drop Linux capabilities.

Preview the build graph:

```bash
REGISTRY=ghcr.io IMAGE_NAMESPACE=owner GIT_SHA=$(git rev-parse HEAD) \
docker buildx bake -f deploy/docker-bake.hcl --print
```

Build and push only from a trusted CI runner. Release manifests and deployment commands must use the resulting immutable `registry/name@sha256:<digest>` references, never `latest` or another mutable tag.

## Environment material

Copy one example outside the repository and replace every placeholder:

- `deploy/env/staging.env.example`
- `deploy/env/production.env.example`

The real env file must remain untracked and be readable only by the deployment account. Secrets should come from the hosting provider secret manager or a root-owned mounted file. `MIGRATION_CONFIRM` is intentionally absent from stored env files; the promotion process injects it only for the one-shot migration job.

`docker compose config` and staging dry-run planning may therefore render the migration service with an empty confirmation value. This does not authorize a migration: `migrate-database.ts` still fails closed unless the executing promotion process injects the exact `APPLY_STAGING` or `APPLY_PRODUCTION` value.

Before promotion:

```bash
DEPLOY_ENV_FILE=/secure/babyloop/staging.env \
node scripts/check-deployment-readiness.mjs --target=staging
```

## Promotion order

`scripts/deploy/promote-release.mjs` enforces this order:

1. Parse the env file without shell evaluation.
2. Require digest-pinned API/web/backoffice images.
3. Validate Docker Compose interpolation.
4. Create a checksum-verified pre-deploy PostgreSQL backup.
5. Run the staging/production deployment readiness gate.
6. Create a release manifest tied to Git SHA, migration head, image digests and backup manifest.
7. Run the advisory-lock protected migration job exactly once.
8. Roll out API, web, backoffice and both worker loops.
9. Wait for liveness, readiness, web, backoffice and protected metrics smoke.
10. Write a checksum-protected deployment receipt under `.release/deployments`.

Staging example:

```bash
DEPLOY_ENVIRONMENT=staging \
DEPLOY_ENV_FILE=/secure/babyloop/staging.env \
DEPLOY_CONFIRM=DEPLOY_STAGING \
API_IMAGE='registry/babyloop-api@sha256:...' \
WEB_IMAGE='registry/babyloop-web@sha256:...' \
BACKOFFICE_IMAGE='registry/babyloop-backoffice@sha256:...' \
pnpm deploy:promote
```

Production additionally requires `DEPLOY_GO_NO_GO=GO`, a verified restore-smoke evidence path, encrypted backup configuration and a previous release manifest unless it is explicitly the first production release.

## Worker contract

The underlying worker scripts remain one-cycle jobs. `worker-loop.mjs` runs one child at a time, waits between cycles, applies a failure backoff and forwards SIGTERM/SIGINT to the active child. This prevents overlapping cycles and avoids a Docker restart hot loop.

Readiness can require both worker heartbeats. The first worker cycles must complete before production readiness is expected to become healthy.

## Migration contract

The migration job:

- requires `MIGRATION_ENVIRONMENT`,
- requires `MIGRATION_CONFIRM=APPLY_STAGING` or `APPLY_PRODUCTION`,
- obtains a PostgreSQL advisory lock,
- applies checked-in migrations from the image,
- always releases the lock and closes the pool.

Migrations are not run automatically from API startup. Multiple API replicas therefore cannot race migrations.

## Reverse proxy and TLS

`deploy/proxy/Caddyfile.example` shows the required three-domain routing. Replace domain variables and configure DNS before promotion. Do not expose the bound application ports directly to the internet.

## Rollback

Application rollback uses the Patch 13 release manifests and the checked-in Docker Compose adapter:

```bash
ROLLBACK_CURRENT_MANIFEST_PATH=.release/manifests/current.json \
ROLLBACK_TARGET_MANIFEST_PATH=.release/manifests/previous.json \
ROLLBACK_DEPLOY_ENV_FILE=/secure/babyloop/production.env \
ROLLBACK_ADAPTER_PATH=scripts/deploy/adapters/docker-compose.mjs \
ROLLBACK_EXECUTE=true \
ROLLBACK_CONFIRM=ROLLBACK_TO_<release-id> \
ROLLBACK_ALLOW_FORWARD_SCHEMA=true \
pnpm ops:release:rollback
```

Rollback never runs a down migration. It keeps the current schema and refuses an older code release unless forward compatibility has been explicitly reviewed.

## Final external work

The repository implementation does not provision a hosting account, managed PostgreSQL, Redis, Qdrant, R2 bucket, DNS records or legal operator identity. Those real resources must be created and their secrets loaded before the first staging promotion. The Galaxy S22 release checklist and final staging GO/NO-GO remain mandatory.

## Release candidate acceptance evidence

Deployment smoke artık yalnızca endpoint availability kontrolü değildir. API listing/category sözleşmelerini, web/backoffice/legal yüzeylerini, güvenlik header'larını, response byte büyüklüklerini ve p50/p95 sürelerini ölçerek checksum korumalı `deployment_acceptance` kanıtı yazar.

Production promotion öncesinde aynı Git SHA için staging acceptance, restore-smoke, Galaxy S22 ve gerçek provider evidence dosyalarından `pnpm release:go-no-go` ile production GO receipt üretilmelidir. `PRODUCTION_GO_NO_GO_RECEIPT_PATH` doğrulanmadan production backup, migration veya rollout başlamaz. Ayrıntılı akış `docs/89-release-candidate-acceptance-go-no-go.md` dosyasındadır.


## Patch 21 staging bootstrap

The executable staging sequence is now documented in `docs/90-staging-bootstrap-provider-readiness.md`. Use separate runtime and release env files, generate a checksum-bound runtime audit and bootstrap plan, and run the live provider probe before production GO/NO-GO.
