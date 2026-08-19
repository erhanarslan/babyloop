#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../../.." && pwd)"
APP_ID="${BABYLOOP_ANDROID_PACKAGE:-com.babyloop.mobile}"
RAW_DIR="$ROOT_DIR/artifacts/linkedin/mobile/raw"
CAROUSEL_DIR="$ROOT_DIR/artifacts/linkedin/mobile/carousel"
TEMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/babyloop-mobile-marketing.XXXXXX")"
MARKETING_API_URL="${MARKETING_API_URL:-http://127.0.0.1:4000}"
MARKETING_API_PORT=""
MARKETING_DEVICE_API_URL=""
DEMO_EMAIL="${BABYLOOP_MARKETING_DEMO_EMAIL:-}"
DEMO_PASSWORD="${BABYLOOP_MARKETING_DEMO_PASSWORD:-}"
METRO_PID=""
WEB_PID=""
REVERSED_PORTS=""
DEVICE_SERIAL=""
ORIGINAL_STAY_AWAKE=""
STAY_AWAKE_CHANGED="0"

cleanup() {
  if [ -n "$METRO_PID" ]; then
    kill "$METRO_PID" >/dev/null 2>&1 || true
  fi

  if [ -n "$WEB_PID" ]; then
    kill "$WEB_PID" >/dev/null 2>&1 || true
  fi

  if [ -n "$DEVICE_SERIAL" ]; then
    if [ "$STAY_AWAKE_CHANGED" = "1" ]; then
      if [ -n "$ORIGINAL_STAY_AWAKE" ] && [ "$ORIGINAL_STAY_AWAKE" != "null" ]; then
        adb -s "$DEVICE_SERIAL" shell settings put global stay_on_while_plugged_in "$ORIGINAL_STAY_AWAKE" >/dev/null 2>&1 || true
      else
        adb -s "$DEVICE_SERIAL" shell settings delete global stay_on_while_plugged_in >/dev/null 2>&1 || true
      fi
    fi

    for port in $REVERSED_PORTS; do
      adb -s "$DEVICE_SERIAL" reverse --remove "tcp:$port" >/dev/null 2>&1 || true
    done
  fi

  rm -r "$TEMP_DIR" >/dev/null 2>&1 || true
}

trap cleanup EXIT INT TERM

log() {
  printf '[mobile-linkedin] %s\n' "$1"
}

fail() {
  printf '[mobile-linkedin] HATA: %s\n' "$1" >&2
  exit 1
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || fail "$1 bulunamadı."
}

resolve_device_serial() {
  if [ -n "${ANDROID_SERIAL:-}" ]; then
    local state
    state="$(adb -s "$ANDROID_SERIAL" get-state 2>/dev/null || true)"
    [ "$state" = "device" ] || fail "ANDROID_SERIAL=$ANDROID_SERIAL bağlı veya yetkili değil."
    printf '%s' "$ANDROID_SERIAL"
    return
  fi

  local authorized=""
  local authorized_count=0
  local unauthorized_count=0
  local serial=""
  local state=""

  while read -r serial state _; do
    case "$state" in
      device)
        authorized="$serial"
        authorized_count=$((authorized_count + 1))
        ;;
      unauthorized)
        unauthorized_count=$((unauthorized_count + 1))
        ;;
    esac
  done < <(adb devices -l | tail -n +2)

  if [ "$authorized_count" -eq 0 ] && [ "$unauthorized_count" -gt 0 ]; then
    fail "Telefon görüldü fakat USB hata ayıklama izni verilmedi. Telefonda izin penceresini onayla."
  fi

  [ "$authorized_count" -gt 0 ] || fail "Yetkili Android cihaz bulunamadı."
  [ "$authorized_count" -eq 1 ] || fail "Birden fazla cihaz bağlı. ANDROID_SERIAL ile seçim yap."
  printf '%s' "$authorized"
}

wait_for_url() {
  local url="$1"
  local attempts="$2"
  local label="$3"
  local attempt=1

  while [ "$attempt" -le "$attempts" ]; do
    if curl -fsS "$url" >/dev/null 2>&1; then
      return
    fi
    sleep 1
    attempt=$((attempt + 1))
  done

  fail "$label hazır olmadı: $url"
}

ensure_reverse() {
  local port="$1"

  if adb -s "$DEVICE_SERIAL" reverse --list | awk -v port="tcp:$port" '$2 == port && $3 == port { found = 1 } END { exit found ? 0 : 1 }'; then
    return
  fi

  adb -s "$DEVICE_SERIAL" reverse "tcp:$port" "tcp:$port" >/dev/null
  REVERSED_PORTS="$REVERSED_PORTS $port"
}

wait_for_unlocked_screen() {
  local attempt=1

  adb -s "$DEVICE_SERIAL" shell input keyevent KEYCODE_WAKEUP >/dev/null 2>&1 || true
  log "Telefon ekranı uyanık ve kilitsiz olmalı; gerekirse şimdi kilidi aç."

  while [ "$attempt" -le 60 ]; do
    if ! adb -s "$DEVICE_SERIAL" shell dumpsys window policy 2>/dev/null | grep -q "showing=true"; then
      ORIGINAL_STAY_AWAKE="$(adb -s "$DEVICE_SERIAL" shell settings get global stay_on_while_plugged_in 2>/dev/null | tr -d '\r')"
      adb -s "$DEVICE_SERIAL" shell svc power stayon usb >/dev/null
      STAY_AWAKE_CHANGED="1"
      return
    fi
    sleep 1
    attempt=$((attempt + 1))
  done

  fail "Telefon kilidi 60 saniye içinde açılmadı. Kilidi açıp komutu tekrar çalıştır."
}

start_web_assets() {
  local asset_url="http://127.0.0.1:3000/brand/home/home-hero-play.png"

  if curl -fsS "$asset_url" >/dev/null 2>&1; then
    log "Yerel web asset sunucusu zaten çalışıyor."
    return
  fi

  log "Demo görselleri için yerel web sunucusu başlatılıyor."
  (
    cd "$ROOT_DIR"
    pnpm --filter @babyloop/web exec next dev --hostname 127.0.0.1 --port 3000
  ) >"$TEMP_DIR/web.log" 2>&1 &
  WEB_PID="$!"
  wait_for_url "$asset_url" 90 "Yerel web asset sunucusu"
}

start_metro() {
  local metro_status="http://127.0.0.1:8081/status"

  if curl -fsS "$metro_status" 2>/dev/null | grep -q "packager-status:running"; then
    [ "${MARKETING_REUSE_METRO:-0}" = "1" ] || fail "8081 üzerinde Metro zaten çalışıyor. Yerel API hedefini kanıtlamak için kapat veya MARKETING_REUSE_METRO=1 ver."
    log "Mevcut Metro açık kullanıcı onayıyla kullanılıyor."
    return
  fi

  log "Yerel API hedefli Expo Metro başlatılıyor."
  (
    cd "$ROOT_DIR"
    CI=1 \
      EXPO_PUBLIC_API_BASE_URL="$MARKETING_DEVICE_API_URL" \
      EXPO_PUBLIC_WEB_BASE_URL="http://localhost:3000" \
      pnpm --filter @babyloop/mobile exec expo start --dev-client --localhost --port 8081
  ) >"$TEMP_DIR/metro.log" 2>&1 &
  METRO_PID="$!"
  wait_for_url "$metro_status" 90 "Expo Metro"
}

verify_png() {
  node -e '
    const fs = require("node:fs");
    const file = process.argv[1];
    const data = fs.readFileSync(file);
    const png = data.length > 8 && data.subarray(1, 4).toString("ascii") === "PNG";
    if (!png) throw new Error("Geçersiz veya boş PNG: " + file);
  ' "$1"
}

run_flow_and_capture() {
  local id="$1"
  local flow="$SCRIPT_DIR/flows/$id.yaml"
  local output="$RAW_DIR/$id.png"
  local deep_link

  case "$id" in
    01-cover|02-discover) deep_link="babyloop://" ;;
    03-listing-detail) deep_link="babyloop://listing/30000000-0000-4000-8000-000000001001" ;;
    04-ai-link-import|05-ai-listing-assistant) deep_link="babyloop://sell" ;;
    06-parent-assistant-rag) deep_link="babyloop://assistant" ;;
    08-account-security) deep_link="babyloop://account" ;;
    *) fail "Bilinmeyen ekran akışı: $id" ;;
  esac

  log "$id ekranı hazırlanıyor."
  adb -s "$DEVICE_SERIAL" shell am start \
    -W \
    -a android.intent.action.VIEW \
    -d "$deep_link" \
    -p "$APP_ID" >/dev/null
  maestro test \
    --device "$DEVICE_SERIAL" \
    --no-ansi \
    --debug-output "$TEMP_DIR/maestro-$id" \
    -e "APP_ID=$APP_ID" \
    -e "DEMO_EMAIL=$DEMO_EMAIL" \
    -e "DEMO_PASSWORD=$DEMO_PASSWORD" \
    "$flow"

  adb -s "$DEVICE_SERIAL" shell cmd statusbar collapse >/dev/null 2>&1 || true
  adb -s "$DEVICE_SERIAL" exec-out screencap -p >"$output"
  verify_png "$output"
  log "Ham PNG: $output"
}

require_command adb
require_command curl
require_command maestro
require_command node
require_command pnpm

MARKETING_API_PORT="$(node -e '
  const url = new URL(process.argv[1]);
  process.stdout.write(url.port || "80");
' "$MARKETING_API_URL")"
MARKETING_DEVICE_API_URL="http://localhost:$MARKETING_API_PORT"

DEVICE_SERIAL="$(resolve_device_serial)"
export DEVICE_SERIAL

[ -n "$DEMO_EMAIL" ] || fail "BABYLOOP_MARKETING_DEMO_EMAIL tanımlanmalı."
[ -n "$DEMO_PASSWORD" ] || fail "BABYLOOP_MARKETING_DEMO_PASSWORD tanımlanmalı."

case "$DEMO_EMAIL" in
  *@example.com|*@example.test|*@babyloop.local) ;;
  *) fail "Yalnız güvenli demo e-posta alanları kullanılabilir." ;;
esac

log "Cihaz doğrulandı: $DEVICE_SERIAL"
adb -s "$DEVICE_SERIAL" shell pm path "$APP_ID" >/dev/null 2>&1 \
  || fail "$APP_ID cihazda kurulu değil."
wait_for_unlocked_screen

cd "$ROOT_DIR"
MARKETING_API_URL="$MARKETING_API_URL" node "$SCRIPT_DIR/preflight.mjs" "$ROOT_DIR/.env.local"
wait_for_url "$MARKETING_API_URL/health/live" 5 "Yerel BabyLoop API"

if [ "${MARKETING_SKIP_SEED:-0}" != "1" ]; then
  log "Local/test demo verisi deterministik olarak hazırlanıyor."
  pnpm --filter @babyloop/database build
  node --env-file-if-exists="$ROOT_DIR/.env.local" "$ROOT_DIR/packages/database/dist/seed.js"
fi

mkdir -p "$RAW_DIR" "$CAROUSEL_DIR"
find "$RAW_DIR" "$CAROUSEL_DIR" -maxdepth 1 -type f -name '*.png' -delete
ensure_reverse 3000
ensure_reverse "$MARKETING_API_PORT"
ensure_reverse 8081
start_web_assets
start_metro

log "Expo development client yerel Metro'ya bağlanıyor."
adb -s "$DEVICE_SERIAL" shell am start \
  -W \
  -a android.intent.action.VIEW \
  -d "babyloop://expo-development-client/?url=http%3A%2F%2Flocalhost%3A8081" \
  -p "$APP_ID" >/dev/null

log "Güvenli demo oturumu hazırlanıyor."
maestro test \
  --device "$DEVICE_SERIAL" \
  --no-ansi \
  --debug-output "$TEMP_DIR/maestro-login" \
  -e "APP_ID=$APP_ID" \
  -e "DEMO_EMAIL=$DEMO_EMAIL" \
  -e "DEMO_PASSWORD=$DEMO_PASSWORD" \
  "$SCRIPT_DIR/flows/00-login.yaml"

for id in \
  01-cover \
  02-discover \
  03-listing-detail \
  04-ai-link-import \
  05-ai-listing-assistant \
  06-parent-assistant-rag \
  08-account-security
do
  run_flow_and_capture "$id"
done

node "$SCRIPT_DIR/compose.mjs" --raw "$RAW_DIR" --output "$CAROUSEL_DIR"

log "Tamamlandı. Ham görseller:"
find "$RAW_DIR" -maxdepth 1 -type f -name '*.png' -print | sort
log "LinkedIn carousel görselleri:"
find "$CAROUSEL_DIR" -maxdepth 1 -type f -name '*.png' -print | sort
