#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

export TEST_DATABASE_URL="${TEST_DATABASE_URL:-postgresql://postgres:postgres@127.0.0.1:5432/babyloop_test}"
export WEB_E2E_FULL_FLOW="${WEB_E2E_FULL_FLOW:-1}"
export WEB_E2E_BASE_URL="${WEB_E2E_BASE_URL:-http://localhost:3000}"
export WEB_E2E_API_BASE_URL="${WEB_E2E_API_BASE_URL:-http://127.0.0.1:4000}"
export BACKOFFICE_E2E_BASE_URL="${BACKOFFICE_E2E_BASE_URL:-http://localhost:3001}"
export BACKOFFICE_E2E_API_BASE_URL="${BACKOFFICE_E2E_API_BASE_URL:-http://127.0.0.1:4000}"

section() {
  printf '\n\033[1;36m===== %s =====\033[0m\n' "$1"
}

section "Git status"
git status --short --untracked-files=all

section "Diff whitespace check"
git diff --check

section "Release artifact guard"
pnpm release:artifacts

if [ "${RUN_DEPLOYMENT_CHECK:-0}" = "1" ]; then
  section "Deployment readiness check"
  node scripts/check-deployment-readiness.mjs --target="${DEPLOYMENT_READINESS_TARGET:-staging}"
fi

section "API typecheck"
pnpm --filter @babyloop/api typecheck

section "Web typecheck"
pnpm --filter @babyloop/web typecheck

section "Backoffice typecheck"
pnpm --filter @babyloop/backoffice typecheck

section "Mobile typecheck"
pnpm --filter @babyloop/mobile typecheck

section "Mobile unit tests"
pnpm --filter @babyloop/mobile test

section "Web SEO regression tests"
pnpm test:web:seo

section "API release regression bundle"
pnpm test:api:release

if [[ "${RUN_API_FULL:-0}" == "1" ]]; then
  section "API full test suite"
  pnpm --filter @babyloop/api test
else
  section "API full test suite skipped"
  echo "Set RUN_API_FULL=1 to run the full API suite."
fi

if [[ "${RUN_WEB_E2E:-0}" == "1" ]]; then
  section "Web release E2E bundle"
  pnpm test:e2e:web:release
else
  section "Web E2E skipped"
  echo "Set RUN_WEB_E2E=1 after starting API + web."
fi

if [[ "${RUN_BACKOFFICE_E2E:-0}" == "1" ]]; then
  section "Backoffice release E2E bundle"
  pnpm test:e2e:backoffice:release
else
  section "Backoffice E2E skipped"
  echo "Set RUN_BACKOFFICE_E2E=1 after starting API + backoffice."
fi

if [[ "${RUN_MOBILE_E2E:-0}" == "1" ]]; then
  section "Mobile Maestro smoke"
  pnpm --filter @babyloop/mobile test:e2e
else
  section "Mobile Maestro skipped"
  echo "Set RUN_MOBILE_E2E=1 when an Android device/emulator is visible to adb."
fi

section "Release smoke completed"
