#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

API_PORT="${API_PORT:-4000}"
WEB_PORT="${WEB_PORT:-3000}"
BACKOFFICE_PORT="${BACKOFFICE_PORT:-3001}"

# Eski/bozuk env değerlerini ez.
unset DATABASE_URL
unset TEST_DATABASE_URL
unset DATABASE_DIRECT_URL

export NODE_ENV="development"

export PORT="$API_PORT"
export API_PORT="$API_PORT"
export WEB_PORT="$WEB_PORT"
export BACKOFFICE_PORT="$BACKOFFICE_PORT"

export DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5432/babyloop_dev"
export TEST_DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5432/babyloop_test"

export AUTH_SECRET="babyloop_local_dev_auth_secret_please_change_later_123456"

export CORS_ORIGINS="http://localhost:${WEB_PORT},http://127.0.0.1:${WEB_PORT},http://localhost:${BACKOFFICE_PORT},http://127.0.0.1:${BACKOFFICE_PORT}"

export NEXT_PUBLIC_API_BASE_URL="http://localhost:${API_PORT}"
export NEXT_PUBLIC_API_URL="http://localhost:${API_PORT}"
export NEXT_PUBLIC_BACKOFFICE_BASE_URL="http://localhost:${BACKOFFICE_PORT}"

echo ""
echo "Using DATABASE_URL=$DATABASE_URL"
echo "Using API_PORT=$API_PORT"
echo "Using WEB_PORT=$WEB_PORT"
echo "Using BACKOFFICE_PORT=$BACKOFFICE_PORT"
echo "Using CORS_ORIGINS=$CORS_ORIGINS"
echo "Using NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL"
echo "Using NEXT_PUBLIC_BACKOFFICE_BASE_URL=$NEXT_PUBLIC_BACKOFFICE_BASE_URL"
echo ""

echo "Stopping old dev servers..."

kill_port() {
  local port="$1"

  if lsof -ti tcp:"$port" >/dev/null 2>&1; then
    echo "Killing process on port $port"
    lsof -ti tcp:"$port" | xargs kill -9 || true
  else
    echo "Port $port is free"
  fi
}

kill_port "$API_PORT"
kill_port "$WEB_PORT"
kill_port "$BACKOFFICE_PORT"

echo ""
echo "Checking babyloop_dev database connection..."

if command -v psql >/dev/null 2>&1; then
  PGPASSWORD=postgres psql "$DATABASE_URL" -c "select 1;" >/dev/null
  echo "Database connection OK"
else
  echo "psql not found. Skipping DB connection check."
fi

echo ""
echo "Cleaning build/dev caches..."

rm -rf apps/api/dist

rm -rf apps/web/.next
rm -rf apps/web/dist

rm -rf apps/backoffice/.next
rm -rf apps/backoffice/dist

rm -rf packages/config/dist
rm -rf packages/shared/dist
rm -rf packages/database/dist

echo ""
echo "Building dependency packages..."

pnpm --filter @babyloop/config build
pnpm --filter @babyloop/shared build
pnpm --filter @babyloop/database build

echo ""
echo "Starting API, Web and Backoffice..."

pnpm --filter @babyloop/api dev &
API_PID=$!

sleep 4

pnpm --filter @babyloop/web dev &
WEB_PID=$!

sleep 2

pnpm --filter @babyloop/backoffice dev &
BACKOFFICE_PID=$!

cleanup() {
  echo ""
  echo "Stopping dev servers..."
  kill "$API_PID" "$WEB_PID" "$BACKOFFICE_PID" 2>/dev/null || true
}

trap cleanup INT TERM EXIT

echo ""
echo "API PID: $API_PID"
echo "WEB PID: $WEB_PID"
echo "BACKOFFICE PID: $BACKOFFICE_PID"
echo ""
echo "API should be on: http://localhost:$API_PORT"
echo "WEB should be on: http://localhost:$WEB_PORT"
echo "BACKOFFICE should be on: http://localhost:$BACKOFFICE_PORT"
echo ""
echo "Manual test targets:"
echo "- Web marketplace: http://localhost:$WEB_PORT"
echo "- Deprecated web admin route: http://localhost:$WEB_PORT/admin"
echo "- Backoffice root: http://localhost:$BACKOFFICE_PORT"
echo "- Backoffice login: http://localhost:$BACKOFFICE_PORT/login"
echo "- Backoffice moderation: http://localhost:$BACKOFFICE_PORT/moderation"
echo ""
echo "Logs are now live."
echo ""

wait