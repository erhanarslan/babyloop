#!/usr/bin/env bash
set -euo pipefail

echo "=== git status ==="
git status --short

echo
echo "=== web routes ==="
find apps/web/src/app -maxdepth 4 -type f \
  | sort

echo
echo "=== public web feature files ==="
find apps/web/src/features -maxdepth 3 -type f \
  | grep -E "assistant|parent-guides|home|listings|favorites|saved-searches|messaging|notifications|safety|seller-dashboard|child-profiles" \
  | sort

echo
echo "=== web typecheck ==="
pnpm --filter @babyloop/web typecheck

echo
echo "=== public web client directive audit ==="
./scripts/public-web-client-directive-audit.sh

echo
echo "=== web build ==="
pnpm --filter @babyloop/web build

echo
echo "=== public web strict privacy grep ==="
grep -R "exactBirth\|birthDate\|dateOfBirth\|document.cookie\|sessionStorage\|refreshToken\|passwordHash\|message.body\|rawPrompt\|rawResponse\|userAgent\|referrer" -n \
  apps/web/src/app \
  apps/web/src/features \
  apps/web/src/components \
  apps/web/src/lib \
  | sort || true

echo
echo "=== public web expected auth token flow references ==="
grep -R "accessToken" -n \
  apps/web/src/features/auth/auth-form.tsx \
  apps/web/src/lib/auth-client.ts \
  apps/web/src/lib/realtime-client.ts \
  apps/web/src/lib/use-protected-route.ts \
  | sort || true

echo
echo "=== public web unexpected access token references ==="
grep -R "accessToken" -n \
  apps/web/src/app \
  apps/web/src/features \
  apps/web/src/components \
  apps/web/src/lib \
  | grep -v "apps/web/src/features/auth/auth-form.tsx" \
  | grep -v "apps/web/src/lib/auth-client.ts" \
  | grep -v "apps/web/src/lib/realtime-client.ts" \
  | grep -v "apps/web/src/lib/use-protected-route.ts" \
  | sort || true

echo
echo "=== hardcoded copy audit candidates ==="
grep -R "BabyLoop Assistant\|Parent guide\|Common misconception\|Marketplace guidance\|Ask Assistant\|Open guides\|Find related listings\|Saved searches" -n \
  apps/web/src/app \
  apps/web/src/features \
  | sort || true

echo
echo "=== copy audit helper ==="
echo "Run ./scripts/public-web-copy-audit.sh when reducing hardcoded copy and moving text to dictionaries."

echo
echo "Public web audit completed."
