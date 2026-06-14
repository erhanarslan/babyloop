#!/usr/bin/env bash
set -euo pipefail

echo "=== public web hardcoded copy candidates ==="
grep -R "BabyLoop Assistant\|Parent guide\|Common misconception\|Marketplace guidance\|Ask Assistant\|Open guides\|Find related listings\|Saved searches\|Secure access\|Create account\|Account recovery\|Set new password\|Verification\|Account security" -n   apps/web/src/app   apps/web/src/features   | sort || true

echo
echo "=== dictionary files ==="
find apps/web/src -type f   | grep -E "dictionary|dictionaries|i18n"   | sort || true

echo
echo "Copy audit completed."
