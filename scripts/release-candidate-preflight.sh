#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

printf '%s\n' '1/7 Tooling, diff and release boundaries'
pnpm preflight
pnpm security:staging-deployment
pnpm security:backup-restore-rollback
pnpm security:legal-public-trust
pnpm security:release-candidate-acceptance
pnpm security:staging-bootstrap
git diff --check

printf '%s\n' '2/7 Deployment, bootstrap and evidence unit tests'
pnpm test:deploy
pnpm test:release-evidence
pnpm test:staging-bootstrap
pnpm test:ops:backup-restore

printf '%s\n' '3/7 Runtime readiness tests'
if [[ -z "${TEST_DATABASE_URL:-}" ]]; then
  echo 'TEST_DATABASE_URL is required for release candidate preflight.' >&2
  exit 1
fi
pnpm test:api:readiness
pnpm test:api:fresh-migrations

printf '%s\n' '4/7 Monorepo release typecheck'
pnpm --filter @babyloop/shared typecheck
pnpm --filter @babyloop/database typecheck
pnpm --filter @babyloop/api typecheck
pnpm --filter @babyloop/web typecheck
pnpm --filter @babyloop/backoffice typecheck
pnpm --filter @babyloop/mobile typecheck

printf '%s\n' '5/7 Production builds'
pnpm --filter @babyloop/api build
pnpm --filter @babyloop/web build
pnpm --filter @babyloop/backoffice build

printf '%s\n' '6/7 Runtime image plan and final repository guard'
if command -v docker >/dev/null 2>&1; then
  pnpm deploy:images:plan >/dev/null
else
  echo 'Docker is unavailable; image bake plan was not rendered in local preflight.' >&2
fi
pnpm release:artifacts
git diff --check

printf '%s\n' '7/7 Protected release workflow posture'
grep -Fq 'pull_request:' .github/workflows/ci.yml
grep -Fq 'branches: [staging, master]' .github/workflows/ci.yml
grep -Fq 'branches: [staging]' .github/workflows/deploy-staging.yml
grep -Fq 'branches: [master]' .github/workflows/promote-production.yml
pnpm security:manual-workflows

echo 'BabyLoop release candidate local preflight passed.'
