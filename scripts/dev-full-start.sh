#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

API_PORT="${API_PORT:-4000}"
WEB_PORT="${WEB_PORT:-3000}"
METRO_PORT="${METRO_PORT:-8081}"
MOBILE_CLEAR_CACHE="${MOBILE_CLEAR_CACHE:-false}"

resolve_lan_ip() {
  if [ -n "${MOBILE_LAN_IP:-}" ]; then
    printf '%s' "$MOBILE_LAN_IP"
    return
  fi

  if command -v ipconfig >/dev/null 2>&1; then
    ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || true
    return
  fi

  if command -v hostname >/dev/null 2>&1; then
    hostname -I 2>/dev/null | awk '{print $1}' || true
  fi
}

LAN_IP="$(resolve_lan_ip)"
if [ -z "$LAN_IP" ]; then
  LAN_IP="127.0.0.1"
fi

STACK_PID=""
MOBILE_PID=""

cleanup() {
  echo ""
  echo "Full development stack durduruluyor..."

  if [ -n "$MOBILE_PID" ]; then
    kill "$MOBILE_PID" 2>/dev/null || true
  fi

  if [ -n "$STACK_PID" ]; then
    kill "$STACK_PID" 2>/dev/null || true
  fi
}

trap cleanup INT TERM EXIT

if lsof -ti tcp:"$METRO_PORT" >/dev/null 2>&1; then
  echo "Metro portu $METRO_PORT temizleniyor..."
  lsof -ti tcp:"$METRO_PORT" | xargs kill -9 || true
fi

echo "API, Web ve Backoffice başlatılıyor..."
bash scripts/dev-clean-start.sh &
STACK_PID=$!

API_READY="false"
for _ in $(seq 1 60); do
  if curl -fsS "http://127.0.0.1:${API_PORT}/health/live" >/dev/null 2>&1; then
    API_READY="true"
    break
  fi

  if ! kill -0 "$STACK_PID" >/dev/null 2>&1; then
    echo "API/Web/Backoffice süreci beklenmedik şekilde kapandı."
    exit 1
  fi

  sleep 1
done

if [ "$API_READY" != "true" ]; then
  echo "API 60 saniye içinde hazır olmadı."
  exit 1
fi

MOBILE_API_URL="http://${LAN_IP}:${API_PORT}"
MOBILE_WEB_URL="http://${LAN_IP}:${WEB_PORT}"

if [ "$LAN_IP" = "127.0.0.1" ]; then
  echo "UYARI: LAN IP bulunamadı. Fiziksel Android cihaz API'ye erişemeyebilir."
  echo "MOBILE_LAN_IP=192.168.x.x bash scripts/dev-full-start.sh biçiminde tekrar çalıştırabilirsin."
fi

EXPO_ARGS=(start --dev-client --lan --port "$METRO_PORT")
if [ "$MOBILE_CLEAR_CACHE" = "true" ]; then
  EXPO_ARGS+=(--clear)
fi

echo ""
echo "Mobil Metro başlatılıyor..."
echo "EXPO_PUBLIC_API_BASE_URL=$MOBILE_API_URL"
echo "EXPO_PUBLIC_WEB_BASE_URL=$MOBILE_WEB_URL"
echo ""

EXPO_PUBLIC_API_BASE_URL="$MOBILE_API_URL" \
EXPO_PUBLIC_WEB_BASE_URL="$MOBILE_WEB_URL" \
pnpm --filter @babyloop/mobile exec expo "${EXPO_ARGS[@]}" &
MOBILE_PID=$!

echo ""
echo "Tüm geliştirme servisleri çalışıyor:"
echo "- API:        http://localhost:${API_PORT}"
echo "- Web:        http://localhost:${WEB_PORT}"
echo "- Backoffice: http://localhost:3001"
echo "- Mobile API: $MOBILE_API_URL"
echo "- Metro:      http://localhost:${METRO_PORT}"
echo ""
echo "Galaxy S22 ile aynı Wi-Fi ağında ol ve development build'i aç."
echo "Durdurmak için Ctrl+C."
echo ""

wait "$STACK_PID" "$MOBILE_PID"
