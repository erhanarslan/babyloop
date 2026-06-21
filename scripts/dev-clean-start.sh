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

load_env_file() {
  if [ -f "$1" ]; then
    echo "Loading $1"
    set -a
    . "$1"
    set +a
  fi
}

load_env_file ".env.local"
load_env_file "apps/api/.env.local"

unset DATABASE_DIRECT_URL

export NODE_ENV="development"

export PORT="$API_PORT"
export API_PORT="$API_PORT"
export WEB_PORT="$WEB_PORT"
export BACKOFFICE_PORT="$BACKOFFICE_PORT"

export DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5432/babyloop_dev"
export TEST_DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5432/babyloop_test"
export ASSISTANT_PROVIDER="${ASSISTANT_PROVIDER:-gemini}"
export AI_LISTING_DRAFT_PROVIDER="${AI_LISTING_DRAFT_PROVIDER:-gemini}"
export AI_MODERATION_SUMMARY_PROVIDER="${AI_MODERATION_SUMMARY_PROVIDER:-gemini}"
export GEMINI_ASSISTANT_MODEL="${GEMINI_ASSISTANT_MODEL:-gemini-2.5-flash-lite}"
export GEMINI_LISTING_DRAFT_MODEL="${GEMINI_LISTING_DRAFT_MODEL:-gemini-2.5-flash}"
export GEMINI_MODERATION_SUMMARY_MODEL="${GEMINI_MODERATION_SUMMARY_MODEL:-gemini-2.5-flash-lite}"
export GEMINI_API_ENDPOINT="${GEMINI_API_ENDPOINT:-https://generativelanguage.googleapis.com}"
export RAG_ENABLED="${RAG_ENABLED:-true}"
export RAG_VECTOR_STORE="${RAG_VECTOR_STORE:-qdrant}"
export RAG_QDRANT_URL="${RAG_QDRANT_URL:-http://localhost:6333}"
export RAG_QDRANT_COLLECTION="${RAG_QDRANT_COLLECTION:-babyloop_rag}"
export RAG_QDRANT_VECTOR_SIZE="${RAG_QDRANT_VECTOR_SIZE:-3072}"
export RAG_EMBEDDING_PROVIDER="${RAG_EMBEDDING_PROVIDER:-gemini}"
export RAG_EMBEDDING_MODEL="${RAG_EMBEDDING_MODEL:-gemini-embedding-001}"
export RAG_CHAT_PROVIDER="${RAG_CHAT_PROVIDER:-gemini}"
export RAG_CHAT_MODEL="${RAG_CHAT_MODEL:-gemini-2.5-flash}"
export RAG_MIN_SCORE="${RAG_MIN_SCORE:-0.72}"
export RAG_MAX_CHUNKS="${RAG_MAX_CHUNKS:-5}"
export RAG_MAX_SOURCES_PER_DOCUMENT="${RAG_MAX_SOURCES_PER_DOCUMENT:-2}"
export RAG_MAX_CONTEXT_CHARS="${RAG_MAX_CONTEXT_CHARS:-8000}"
export RAG_REQUIRE_SOURCES="${RAG_REQUIRE_SOURCES:-true}"
export RAG_REDIS_ENABLED="${RAG_REDIS_ENABLED:-false}"
export RAG_REDIS_URL="${RAG_REDIS_URL:-redis://localhost:6379}"
export RAG_REDIS_KEY_PREFIX="${RAG_REDIS_KEY_PREFIX:-babyloop:rag}"
export RAG_REDIS_CONNECT_TIMEOUT_MS="${RAG_REDIS_CONNECT_TIMEOUT_MS:-1000}"
export RAG_CACHE_ENABLED="${RAG_CACHE_ENABLED:-true}"
export RAG_CACHE_BACKEND="${RAG_CACHE_BACKEND:-memory}"
export RAG_CACHE_TTL_SECONDS="${RAG_CACHE_TTL_SECONDS:-900}"
export RAG_CACHE_MAX_ENTRIES="${RAG_CACHE_MAX_ENTRIES:-200}"
export RAG_USAGE_LIMITS_ENABLED="${RAG_USAGE_LIMITS_ENABLED:-true}"
export RAG_USAGE_LIMITS_BACKEND="${RAG_USAGE_LIMITS_BACKEND:-memory}"
export RAG_HOURLY_GUEST_LIMIT="${RAG_HOURLY_GUEST_LIMIT:-10}"
export RAG_DAILY_GUEST_LIMIT="${RAG_DAILY_GUEST_LIMIT:-20}"
export RAG_HOURLY_USER_LIMIT="${RAG_HOURLY_USER_LIMIT:-50}"
export RAG_DAILY_USER_LIMIT="${RAG_DAILY_USER_LIMIT:-100}"
export RAG_ADMIN_LIMIT_BYPASS="${RAG_ADMIN_LIMIT_BYPASS:-true}"
export RAG_METRICS_ENABLED="${RAG_METRICS_ENABLED:-true}"
export RAG_METRICS_BACKEND="${RAG_METRICS_BACKEND:-memory}"
export RAG_LIVE_EVAL_ENABLED="${RAG_LIVE_EVAL_ENABLED:-false}"
export RAG_HYBRID_ENABLED="${RAG_HYBRID_ENABLED:-true}"
export RAG_LEXICAL_SCORE_WEIGHT="${RAG_LEXICAL_SCORE_WEIGHT:-0.18}"
export RAG_VECTOR_SCORE_WEIGHT="${RAG_VECTOR_SCORE_WEIGHT:-1}"
export RAG_TITLE_MATCH_BONUS="${RAG_TITLE_MATCH_BONUS:-0.04}"
export RAG_SECTION_MATCH_BONUS="${RAG_SECTION_MATCH_BONUS:-0.03}"
export RAG_TOPIC_MATCH_BONUS="${RAG_TOPIC_MATCH_BONUS:-0.03}"
export RAG_SOURCE_RELIABILITY_BONUS="${RAG_SOURCE_RELIABILITY_BONUS:-0.02}"
export RAG_DUPLICATE_PENALTY="${RAG_DUPLICATE_PENALTY:-0.05}"
export RAG_NO_SOURCE_MIN_SCORE="${RAG_NO_SOURCE_MIN_SCORE:-0.68}"
export RAG_MIN_SOURCE_COVERAGE="${RAG_MIN_SOURCE_COVERAGE:-1}"
export OPENAI_ASSISTANT_MODEL="${OPENAI_ASSISTANT_MODEL:-gpt-5.4-mini}"
export OPENAI_LISTING_DRAFT_MODEL="${OPENAI_LISTING_DRAFT_MODEL:-gpt-5.4-mini}"
export OPENAI_MODERATION_SUMMARY_MODEL="${OPENAI_MODERATION_SUMMARY_MODEL:-gpt-5.4-mini}"
export OPENAI_RESPONSES_ENDPOINT="${OPENAI_RESPONSES_ENDPOINT:-https://api.openai.com/v1/responses}"

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
echo "Using ASSISTANT_PROVIDER=$ASSISTANT_PROVIDER model=$GEMINI_ASSISTANT_MODEL"
echo "Using AI_LISTING_DRAFT_PROVIDER=$AI_LISTING_DRAFT_PROVIDER model=$GEMINI_LISTING_DRAFT_MODEL"
echo "Using AI_MODERATION_SUMMARY_PROVIDER=$AI_MODERATION_SUMMARY_PROVIDER model=$GEMINI_MODERATION_SUMMARY_MODEL"
echo "Using RAG_ENABLED=$RAG_ENABLED vector_store=$RAG_VECTOR_STORE collection=$RAG_QDRANT_COLLECTION embedding_model=$RAG_EMBEDDING_MODEL chat_model=$RAG_CHAT_MODEL"
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
