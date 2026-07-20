# Deployment readiness gate

The deployment readiness gate documents the minimum BabyLoop staging/production requirements. The repository includes an executable provider-neutral Docker deployment path, but it does not create cloud resources or provision managed PostgreSQL, Redis, Qdrant, R2/S3, registry, DNS or TLS accounts.

Guard command:

```bash
pnpm security:deployment-readiness
```

This guard is also wired into:

```bash
pnpm beta:critical-smoke
```

## Deployment status

Current status: repository deployment implementation complete; real infrastructure provisioning and manual approval remain pending. Manual approval is required before beta production release.

## Required environment variables

Environment variables must be split by environment:

- local
- test
- staging
- production

Before staging or production deploy, every required environment variable must have:

- owner
- purpose
- rotation plan
- safe example value
- source of truth
- service/app scope
- secret/non-secret classification

Do not commit real secrets. Documentation must use placeholders only.

## Secret management

Required before deploy:

- no production secret in repo history
- no production secret in local committed files
- secret rotation process
- per-service least-privilege secret access
- separate staging and production secrets
- emergency revocation checklist
- `security:auth-leaks` passing
- `release:artifacts` passing

## Database migration gate

Required before deploy:

- migration dry-run against staging clone or test database
- rollback notes for every irreversible migration
- backup/restore procedure
- migration owner
- migration execution window
- post-migration verification query list
- no direct production database access from app development shell

Database migration must be explicitly reviewed before production.

## Build and runtime gate

Required before deploy:

- `pnpm beta:critical-smoke` passes
- API/backoffice/web/mobile typecheck passes
- API security aggregate passes
- release artifact guard passes
- Node and pnpm versions pinned
- app health endpoints documented
- CORS/cookie/CSRF environment configuration reviewed
- public web and backoffice domains separated

## Observability gate

Required before deploy:

- structured request logging
- error tracking plan
- uptime check plan
- API latency/error-rate dashboard
- auth failure dashboard
- notification readiness dashboard
- storage/image safety dashboard
- alert owner and escalation path

## Rollback gate

Required before deploy:

- previous deploy artifact or Git SHA recorded
- rollback command documented
- database rollback/forward-fix plan documented
- feature flags or kill switches for risky release items
- manual release decision recorded as go/no-go

## Service readiness

### API

- database migrations reviewed
- auth/cookie/CSRF config reviewed
- rate limits reviewed
- moderation and report flows smoke tested
- assistant safety guard passing

### Web

- public auth/session flow smoke tested
- browse/listing/detail/sell/favorite smoke tested
- SEO sitemap/robots/open graph reviewed before public launch

### Backoffice

- admin auth, RBAC, CSRF, audit, redaction smoke tested
- storage ops preview passing
- notification ops readiness passing

### Mobile

- physical Galaxy S22 QA evidence recorded
- OTP/MFA mobile handling checked
- bottom tab/safe-area behavior checked
- push/n8n readiness copy remains disabled and honest

## Non-goals

The repository can execute deployment against operator-provided Docker and managed dependencies, but it does not create cloud accounts, DNS records, databases, buckets, Redis/Qdrant instances, provider credentials or legal identity. Manual approval is required before beta production release.

## Runtime health and observability deployment requirements

Staging and production deployment readiness must configure authenticated metrics, an HTTPS error-reporting sink, worker heartbeat requirements, stale claim policy, and migration `0043_runtime_readiness_observability`. Liveness must not depend on external services; readiness must fail closed for every dependency explicitly marked required.

## Backup, restore, and rollback implementation gate

The repository now includes executable PostgreSQL backup, checksum verification, age encryption, retention, controlled restore, isolated restore smoke, release manifest, and rollback-plan tooling.

Required commands:

```bash
pnpm security:backup-restore-rollback
pnpm test:ops:backup-restore
TEST_DATABASE_URL=... pnpm ops:db:restore-smoke
```

Production readiness additionally requires an encrypted pre-deploy backup, a checksum-verified replica copy, restore-smoke evidence, immutable release image digests, and a previous release manifest. Database rollback is forward-only: the current schema is retained and older code is allowed only after explicit compatibility review. Docker Compose rollback execution is implemented by the checked-in adapter under `scripts/deploy/adapters/docker-compose.mjs`. Other hosting providers still require their own reviewed adapter.

## Legal/KVKK release gate

The deployment readiness gate requires the checked-in legal/public-trust boundary, versioned acceptance migration and real staging/production environment variables. It rejects placeholder operator identity, invalid contact email, unusable application address, local mobile web URLs and non-HTTPS public legal-link origins. Run `pnpm security:legal-public-trust` before staging promotion. This technical gate does not replace qualified legal review.

## Executable staging and production deployment implementation

The repository now includes a provider-neutral Docker deployment implementation:

- `deploy/docker/Dockerfile` with API, web and backoffice runtime targets,
- `deploy/docker-bake.hcl` for multi-platform image planning,
- `deploy/compose/docker-compose.runtime.yml` for API, web, backoffice, migration and both worker loops,
- `scripts/deploy/promote-release.mjs` for ordered backup, readiness, manifest, migration, rollout and smoke,
- `scripts/deploy/adapters/docker-compose.mjs` for manifest-based application rollback,
- `docs/85-staging-production-deployment.md` as the operator runbook.

All staging and production images must be digest-pinned. Migration is a separate advisory-lock protected job and never runs from API startup. API, web and backoffice containers run unprivileged with read-only filesystems; worker loops prevent overlap and forward termination signals.

This implementation does not create cloud resources. Managed PostgreSQL, Redis, Qdrant, R2/S3, registry, reverse proxy host, DNS and secret-manager entries still require explicit operator provisioning. Manual approval is required before beta production release.
