#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

if [[ -z "${DEPLOY_RELEASE_ENV_FILE:-}" ]]; then
  echo "DEPLOY_RELEASE_ENV_FILE is required." >&2
  exit 1
fi
if [[ -z "${DEPLOY_ENV_FILE:-}" ]]; then
  echo "DEPLOY_ENV_FILE is required." >&2
  exit 1
fi

printf '%s\n' '1/5 Runtime env audit'
node scripts/deploy/audit-runtime-env.mjs \
  "--env-file=${DEPLOY_ENV_FILE}" \
  --target=staging \
  "--output=${RUNTIME_ENV_AUDIT_EVIDENCE_PATH:?RUNTIME_ENV_AUDIT_EVIDENCE_PATH is required}"

printf '%s\n' '2/5 Deployment readiness'
node scripts/deploy/check-runtime-env-readiness.mjs \
  "--env-file=${DEPLOY_ENV_FILE}" \
  --target=staging

printf '%s\n' '3/5 Staging bootstrap plan'
node scripts/deploy/create-staging-bootstrap-plan.mjs \
  "--release-env=${DEPLOY_RELEASE_ENV_FILE}"

printf '%s\n' '4/5 Provider probe plan'
node scripts/deploy/provider-probe.mjs \
  "--env-file=${DEPLOY_ENV_FILE}" \
  --mode=plan

printf '%s\n' '5/5 Repository release boundaries'
pnpm security:staging-bootstrap
pnpm security:release-candidate-acceptance
git diff --check

echo "Staging bootstrap preparation passed. No deployment or provider mutation was executed."
