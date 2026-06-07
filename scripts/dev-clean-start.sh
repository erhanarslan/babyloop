#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

API_PORT="${API_PORT:-4000}"
WEB_PORT="${WEB_PORT:-3000}"

# Eski/bozuk env değerlerini ez.
unset DATABASE_URL
unset TEST_DATABASE_URL
unset DATABASE_DIRECT_URL

export NODE_ENV="development"
export PORT="$API_PORT"
export API_PORT="$API_PORT"
export WEB_PORT="$WEB_PORT"

export DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5432/babyloop_dev"
export TEST_DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5432/babyloop_test"

export AUTH_SECRET="babyloop_local_dev_auth_secret_please_change_later_123456"
export CORS_ORIGINS="http://localhost:3000,http://127.0.0.1:3000"

export NEXT_PUBLIC_API_BASE_URL="http://localhost:${API_PORT}"
export NEXT_PUBLIC_API_URL="http://localhost:${API_PORT}"

echo ""
echo "Using DATABASE_URL=$DATABASE_URL"
echo "Using API_PORT=$API_PORT"
echo "Using WEB_PORT=$WEB_PORT"
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

rm -rf packages/config/dist
rm -rf packages/shared/dist
rm -rf packages/database/dist

echo ""
echo "Building dependency packages..."

pnpm --filter @babyloop/config build
pnpm --filter @babyloop/shared build
pnpm --filter @babyloop/database build

echo ""
echo "Starting API and Web..."

pnpm --filter @babyloop/api dev &
API_PID=$!

sleep 4

pnpm --filter @babyloop/web dev &
WEB_PID=$!

cleanup() {
  echo ""
  echo "Stopping dev servers..."
  kill "$API_PID" "$WEB_PID" 2>/dev/null || true
}

trap cleanup INT TERM EXIT

echo ""
echo "API PID: $API_PID"
echo "WEB PID: $WEB_PID"
echo ""
echo "API should be on: http://localhost:$API_PORT"
echo "WEB should be on: http://localhost:$WEB_PORT"
echo ""
echo "Logs are now live. Open /conversations and watch backend logs."
echo ""

wait
