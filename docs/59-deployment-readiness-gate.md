# Deployment readiness gate

The deployment readiness gate documents the minimum BabyLoop staging/production readiness requirements. This package is a readiness boundary only: it does not deploy, does not create cloud resources, and does not enable AWS, Kubernetes, S3/R2, Redis, n8n, push, email, payment, or production database access.

Guard command:

```bash
pnpm security:deployment-readiness
```

This guard is also wired into:

```bash
pnpm beta:critical-smoke
```

## Deployment status

Current status: blocked/readiness-only.

Staging/prod deploy remains blocked until explicit implementation and manual approval. Manual approval is required before beta production release.

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

This gate does not deploy, does not create cloud resources, does not enable AWS/Kubernetes/S3/R2/Redis, does not enable n8n workflow, does not enable push sender, does not enable email sender, does not enable payment, and does not enable production database access.

Exact guard wording: staging/prod deploy remains blocked until explicit implementation.
Exact guard wording: manual approval is required before beta production release.

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

Production readiness additionally requires an encrypted pre-deploy backup, a checksum-verified replica copy, restore-smoke evidence, immutable release image digests, and a previous release manifest. Database rollback is forward-only: the current schema is retained and older code is allowed only after explicit compatibility review. Provider-specific rollback execution remains blocked until a checked-in deployment adapter is added under `scripts/deploy/adapters/`.
