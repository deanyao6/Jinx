#!/usr/bin/env bash
# Builds and launches the app in the iOS Simulator, working around two things that stop
# `expo run:ios` on a machine with no Apple developer certificate. See docs/simulator.md.
#
#  1. Expo refuses to build even for a simulator when the project declares the Sign in with Apple
#     entitlement, unless a development signing identity exists. Simulators do not need signing,
#     so this builds with xcodebuild and signing switched off.
#  2. The Sentry config plugin runs a source-map upload during the build and fails when SENTRY_ORG
#     and SENTRY_PROJECT are unset, which is normal for local work.
#
# Once you join the Apple Developer Program and Xcode has a certificate, plain `expo run:ios`
# works and this script is no longer needed.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP_DIR="$ROOT/apps/mobile"
IOS_DIR="$APP_DIR/ios"
DEVICE="${IOS_SIM_DEVICE:-iPhone 17 Pro}"
SCHEME="${IOS_SCHEME:-Jinx}"
export LANG="${LANG:-en_US.UTF-8}"

if ! xcode-select -p 2>/dev/null | grep -q Xcode; then
  echo "Xcode is not selected. Run scripts/setup-simulator.sh first." >&2
  exit 1
fi

# The native project is generated, and it goes stale the moment a native dependency or an
# app.json plugin or permission string changes. Before 2026-09-23 this only ran prebuild when
# ios/ was missing, so adding expo-camera and expo-contacts produced a build that compiled
# happily and then died at launch with "Cannot find native module 'ExpoContactsNext'". The
# stamp below is the fingerprint of everything prebuild reads, so a changed dependency
# regenerates the project and reinstalls the pods instead of failing on the device.
NATIVE_STAMP="$IOS_DIR/.jinx-native-stamp"
NATIVE_FINGERPRINT="$(cat "$APP_DIR/package.json" "$APP_DIR/app.json" 2>/dev/null | shasum -a 256 | cut -d" " -f1)"
NEEDS_PREBUILD=0
if [ ! -d "$IOS_DIR" ]; then
  echo "==> No ios/ directory, running prebuild"
  NEEDS_PREBUILD=1
elif [ ! -f "$NATIVE_STAMP" ] || [ "$(cat "$NATIVE_STAMP")" != "$NATIVE_FINGERPRINT" ]; then
  echo "==> Native dependencies or app.json changed, regenerating ios/"
  NEEDS_PREBUILD=1
fi

if [ "$NEEDS_PREBUILD" = "1" ]; then
  (cd "$APP_DIR" && npx expo prebuild --platform ios --no-install)
  echo "==> pod install"
  (cd "$IOS_DIR" && pod install >/dev/null)
  printf '%s' "$NATIVE_FINGERPRINT" > "$NATIVE_STAMP"
  # A regenerated project means the JS almost certainly moved too, and Metro does not watch
  # reliably here: a stale bundle on a fresh binary is the hardest failure in this repo to read.
  RESTART_METRO=1
fi

echo "==> Booting $DEVICE"
UUID_RE='[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}'
AVAIL="$(xcrun simctl list devices available)"
# macOS awk has no 3-argument match(), so pull the first UUID on the matching line with grep.
UDID="$(grep -F "$DEVICE (" <<<"$AVAIL" | head -1 | grep -oE "$UUID_RE" | head -1)"
if [ -z "$UDID" ]; then
  UDID="$(grep -F 'iPhone' <<<"$AVAIL" | head -1 | grep -oE "$UUID_RE" | head -1)"
fi
[ -n "$UDID" ] || { echo "No simulator found. Run scripts/setup-simulator.sh." >&2; exit 1; }
xcrun simctl boot "$UDID" 2>/dev/null || true
open "$(xcode-select -p)/Applications/Simulator.app"

echo "==> Building (first run takes 10-20 minutes, later runs are incremental)"
cd "$IOS_DIR"
LOG="$IOS_DIR/build/last-build.log"
mkdir -p "$(dirname "$LOG")"
if ! SENTRY_DISABLE_AUTO_UPLOAD=true xcodebuild \
  -workspace "$SCHEME.xcworkspace" -scheme "$SCHEME" \
  -configuration Debug -sdk iphonesimulator \
  -destination "id=$UDID" -derivedDataPath build \
  CODE_SIGNING_ALLOWED=NO CODE_SIGNING_REQUIRED=NO ENTITLEMENTS_REQUIRED=NO \
  build >"$LOG" 2>&1; then
  echo "Build failed. Last errors:" >&2
  grep -E 'error: |\*\* BUILD FAILED' "$LOG" | tail -20 >&2
  echo "Full log: $LOG" >&2
  exit 1
fi
grep -c 'error: ' "$LOG" >/dev/null 2>&1 || true
echo "    build succeeded"

APP="$IOS_DIR/build/Build/Products/Debug-iphonesimulator/$SCHEME.app"
[ -d "$APP" ] || { echo "Build produced no app at $APP" >&2; exit 1; }
BUNDLE_ID="$(defaults read "$APP/Info.plist" CFBundleIdentifier)"

echo "==> Installing $BUNDLE_ID"
xcrun simctl install "$UDID" "$APP"

if [ "${RESTART_METRO:-0}" = "1" ] && curl -fsS -o /dev/null http://127.0.0.1:8081/status 2>/dev/null; then
  echo "==> Restarting Metro with a cleared cache (the native project changed)"
  pkill -f "expo start --port 8081" 2>/dev/null || true
  sleep 2
  (cd "$APP_DIR" && npx expo start --port 8081 --clear >/dev/null 2>&1 &)
  until curl -fsS -o /dev/null http://127.0.0.1:8081/status 2>/dev/null; do sleep 2; done
elif curl -fsS -o /dev/null http://127.0.0.1:8081/status 2>/dev/null; then
  echo "==> Metro already running on 8081"
else
  echo "==> Starting Metro"
  (cd "$APP_DIR" && npx expo start --port 8081 >/dev/null 2>&1 &)
  until curl -fsS -o /dev/null http://127.0.0.1:8081/status 2>/dev/null; do sleep 2; done
fi

echo "==> Launching"
xcrun simctl launch "$UDID" "$BUNDLE_ID"
echo
echo "The app is running in the Simulator. Edit anything under apps/mobile/src and it reloads."
