#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

printf '%s\n' '1/6 Tooling, diff and release boundaries'
pnpm preflight
pnpm security:staging-deployment
pnpm security:backup-restore-rollback
pnpm security:legal-public-trust
pnpm security:release-candidate-acceptance
git diff --check

printf '%s\n' '2/6 Deployment and evidence unit tests'
pnpm test:deploy
pnpm test:release-evidence
pnpm test:ops:backup-restore

printf '%s\n' '3/6 Runtime readiness tests'
if [[ -z "${TEST_DATABASE_URL:-}" ]]; then
  echo 'TEST_DATABASE_URL is required for release candidate preflight.' >&2
  exit 1
fi
pnpm test:api:readiness
pnpm test:api:fresh-migrations

printf '%s\n' '4/6 Monorepo release typecheck'
pnpm --filter @babyloop/shared typecheck
pnpm --filter @babyloop/database typecheck
pnpm --filter @babyloop/api typecheck
pnpm --filter @babyloop/web typecheck
pnpm --filter @babyloop/backoffice typecheck
pnpm --filter @babyloop/mobile typecheck

printf '%s\n' '5/6 Production builds'
pnpm --filter @babyloop/api build
pnpm --filter @babyloop/web build
pnpm --filter @babyloop/backoffice build

printf '%s\n' '6/6 Final repository guard'
pnpm release:artifacts
git diff --check

echo 'BabyLoop release candidate local preflight passed.'
