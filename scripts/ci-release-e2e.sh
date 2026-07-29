#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

# Keep release E2E isolated from the developer shell DB, but keep the proven app ports.
if [ -n "${NODE_ENV:-}" ] && [ "$NODE_ENV" != "development" ]; then
  echo "Release E2E refuses externally supplied NODE_ENV values other than development."
  exit 1
fi
export NODE_ENV="development"

if [ -n "${DATABASE_URL:-}" ] && [ -n "${TEST_DATABASE_URL:-}" ] && [ "$DATABASE_URL" != "$TEST_DATABASE_URL" ]; then
  echo "Release E2E requires DATABASE_URL and TEST_DATABASE_URL to be identical."
  exit 1
fi

export DATABASE_URL="${CI_E2E_DATABASE_URL:-${DATABASE_URL:-${TEST_DATABASE_URL:-postgresql://postgres:postgres@127.0.0.1:5432/babyloop_test}}}"
export TEST_DATABASE_URL="${TEST_DATABASE_URL:-$DATABASE_URL}"
node scripts/validate-release-e2e-runtime.mjs >/dev/null

# IMPORTANT:
# Web E2E has already been stabilized against localhost:3000 + API 127.0.0.1:4000.
# Do not silently move these to 3100/4100; that changes the app/test contract.
export API_PORT="${CI_E2E_API_PORT:-4000}"
export PORT="$API_PORT"
export WEB_PORT="${CI_E2E_WEB_PORT:-3000}"
export BACKOFFICE_PORT="${CI_E2E_BACKOFFICE_PORT:-3001}"
export API_HOST="${API_HOST:-0.0.0.0}"

node scripts/check-release-e2e-ports.mjs "$API_PORT" "$WEB_PORT" "$BACKOFFICE_PORT"
mkdir -p .e2e-results

export AUTH_SECRET="${AUTH_SECRET:-babyloop_ci_e2e_auth_secret_please_change_later_123456}"
export ALLOW_AUTH_UNAVAILABLE="${ALLOW_AUTH_UNAVAILABLE:-false}"
export BABYLOOP_EXPOSE_DEV_AUTH_TOKENS="1"
export AUTH_RATE_LIMIT_MAX="200"
export AUTH_RATE_LIMIT_WINDOW_SECONDS="60"

export WEB_APP_URL="${WEB_APP_URL:-http://localhost:${WEB_PORT}}"
export CORS_ORIGINS="${CORS_ORIGINS:-http://localhost:${WEB_PORT},http://127.0.0.1:${WEB_PORT},http://localhost:${BACKOFFICE_PORT},http://127.0.0.1:${BACKOFFICE_PORT}}"

export NEXT_PUBLIC_API_BASE_URL="${NEXT_PUBLIC_API_BASE_URL:-http://127.0.0.1:${API_PORT}}"
export NEXT_PUBLIC_API_URL="${NEXT_PUBLIC_API_URL:-$NEXT_PUBLIC_API_BASE_URL}"
export BABYLOOP_API_BASE_URL="${BABYLOOP_API_BASE_URL:-$NEXT_PUBLIC_API_BASE_URL}"
export NEXT_PUBLIC_SITE_URL="${NEXT_PUBLIC_SITE_URL:-http://localhost:${WEB_PORT}}"
export BABYLOOP_SITE_URL="${BABYLOOP_SITE_URL:-$NEXT_PUBLIC_SITE_URL}"
export NEXT_PUBLIC_BACKOFFICE_BASE_URL="${NEXT_PUBLIC_BACKOFFICE_BASE_URL:-http://localhost:${BACKOFFICE_PORT}}"

export WEB_E2E_FULL_FLOW="${WEB_E2E_FULL_FLOW:-1}"
export WEB_E2E_BASE_URL="${WEB_E2E_BASE_URL:-http://localhost:${WEB_PORT}}"
export WEB_E2E_API_BASE_URL="${WEB_E2E_API_BASE_URL:-http://127.0.0.1:${API_PORT}}"
export BACKOFFICE_E2E_BASE_URL="${BACKOFFICE_E2E_BASE_URL:-http://localhost:${BACKOFFICE_PORT}}"
export BACKOFFICE_E2E_API_BASE_URL="${BACKOFFICE_E2E_API_BASE_URL:-http://127.0.0.1:${API_PORT}}"

export EMAIL_DELIVERY_MODE="${EMAIL_DELIVERY_MODE:-noop}"
export EMAIL_PROVIDER="${EMAIL_PROVIDER:-mock}"
export EMAIL_SEND_ENABLED="${EMAIL_SEND_ENABLED:-false}"

export IMAGE_STORAGE_DRIVER="${IMAGE_STORAGE_DRIVER:-local}"
export LISTING_IMAGE_AUTHENTICITY_PROVIDER="${LISTING_IMAGE_AUTHENTICITY_PROVIDER:-mock}"

export ASSISTANT_PROVIDER="${ASSISTANT_PROVIDER:-mock}"
export AI_LISTING_DRAFT_PROVIDER="${AI_LISTING_DRAFT_PROVIDER:-mock}"
export AI_MODERATION_SUMMARY_PROVIDER="${AI_MODERATION_SUMMARY_PROVIDER:-mock}"
export RAG_ENABLED="${RAG_ENABLED:-false}"

API_PID=""
WEB_PID=""
BACKOFFICE_PID=""

section() {
  echo ""
  echo "===== $1 ====="
}

wait_for_service() {
  local service_name="$1"
  local service_url="$2"
  local timeout_ms="$3"
  local process_id="$4"
  local log_file="$5"
  local waiter_pid

  node scripts/wait-on-url.mjs "$service_url" "$timeout_ms" 1_000 &
  waiter_pid="$!"

  while kill -0 "$waiter_pid" 2>/dev/null; do
    if ! kill -0 "$process_id" 2>/dev/null; then
      kill "$waiter_pid" 2>/dev/null || true
      wait "$waiter_pid" 2>/dev/null || true
      echo "$service_name exited before its health endpoint became ready."
      if [ -f "$log_file" ]; then
        tail -n 220 "$log_file" || true
      fi
      return 1
    fi
    sleep 1
  done

  wait "$waiter_pid"
}

dump_logs() {
  section "Release E2E debug logs"

  for file in .e2e-results/api.log .e2e-results/web.log .e2e-results/backoffice.log; do
    if [ -f "$file" ]; then
      echo ""
      echo "----- $file -----"
      tail -n 220 "$file" || true
    else
      echo ""
      echo "----- $file missing -----"
    fi
  done
}

cleanup() {
  status=$?

  set +e

  if [ "$status" -ne 0 ]; then
    dump_logs
  fi

  if [ -n "$BACKOFFICE_PID" ]; then
    kill "$BACKOFFICE_PID" 2>/dev/null
  fi

  if [ -n "$WEB_PID" ]; then
    kill "$WEB_PID" 2>/dev/null
  fi

  if [ -n "$API_PID" ]; then
    kill "$API_PID" 2>/dev/null
  fi

  wait "$BACKOFFICE_PID" "$WEB_PID" "$API_PID" 2>/dev/null

  exit "$status"
}

trap cleanup EXIT

section "Release E2E environment"
echo "Database target validated: local babyloop_test (credentials redacted)"
echo "API health URL=http://127.0.0.1:${API_PORT}/health"
echo "WEB_E2E_BASE_URL=$WEB_E2E_BASE_URL"
echo "WEB_E2E_API_BASE_URL=$WEB_E2E_API_BASE_URL"
echo "BACKOFFICE_E2E_BASE_URL=$BACKOFFICE_E2E_BASE_URL"

section "Database migrate and seed"
pnpm --filter @babyloop/database db:migrate
pnpm demo:seed

section "Build API before server boot"
pnpm --filter @babyloop/api build

section "Start API"
pnpm --filter @babyloop/api start > .e2e-results/api.log 2>&1 &
API_PID="$!"
wait_for_service "API" "http://127.0.0.1:${API_PORT}/health" 90_000 "$API_PID" ".e2e-results/api.log"

section "Build web dependencies"
pnpm --filter @babyloop/web build:deps

# This gate intentionally uses Next dev: it is a local release E2E, not production runtime acceptance.
section "Start web (local release E2E: next dev)"
pnpm --filter @babyloop/web exec next dev --hostname 0.0.0.0 --port "$WEB_PORT" > .e2e-results/web.log 2>&1 &
WEB_PID="$!"
wait_for_service "Web" "$WEB_E2E_BASE_URL" 120_000 "$WEB_PID" ".e2e-results/web.log"

section "Build backoffice dependencies"
pnpm --filter @babyloop/backoffice build:deps

section "Start backoffice (local release E2E: next dev)"
pnpm --filter @babyloop/backoffice exec next dev --hostname 0.0.0.0 --port "$BACKOFFICE_PORT" > .e2e-results/backoffice.log 2>&1 &
BACKOFFICE_PID="$!"
wait_for_service "Backoffice" "$BACKOFFICE_E2E_BASE_URL/login" 120_000 "$BACKOFFICE_PID" ".e2e-results/backoffice.log"

section "Install Playwright Chromium"
if [ "${CI:-}" = "true" ]; then
  pnpm --filter @babyloop/web exec playwright install --with-deps chromium
else
  pnpm --filter @babyloop/web exec playwright install chromium
fi

section "Run web release E2E"
pnpm test:e2e:web:release

section "Run backoffice release E2E"
pnpm test:e2e:backoffice:release

section "Release E2E completed"
